/**
 * Dependency Injection Container
 * 
 * Provides a centralized service registry with dependency injection capabilities
 * for improved testability, loose coupling, and better architecture.
 * 
 * AIDEV-NOTE: Modern DI container for better testability and service management
 */

export type ServiceConstructor<T = any> = new (...args: any[]) => T;
export type ServiceFactory<T = any> = () => T | Promise<T>;
export type ServiceInstance<T = any> = T;

export interface ServiceDefinition<T = any> {
  instance?: ServiceInstance<T>;
  constructor?: ServiceConstructor<T>;
  factory?: ServiceFactory<T>;
  dependencies?: string[];
  singleton?: boolean;
}

export interface DIContainerInterface {
  register<T>(name: string, definition: ServiceDefinition<T>): void;
  get<T>(name: string): T;
  has(name: string): boolean;
  clear(): void;
  createScope(): DIContainer;
}

/**
 * Dependency Injection Container implementation
 */
export class DIContainer implements DIContainerInterface {
  private services = new Map<string, ServiceDefinition>();
  private instances = new Map<string, any>();
  private isResolving = new Set<string>();

  /**
   * Register a service in the container
   */
  register<T>(name: string, definition: ServiceDefinition<T>): void {
    if (this.services.has(name)) {
      console.warn(`[DIContainer] Service '${name}' is being overridden`);
    }

    this.services.set(name, {
      singleton: true, // Default to singleton
      ...definition
    });

    // If an instance is provided directly, store it
    if (definition.instance) {
      this.instances.set(name, definition.instance);
    }
  }

  /**
   * Register a singleton service instance
   */
  registerSingleton<T>(name: string, instance: T): void {
    this.register(name, { 
      instance, 
      singleton: true,
      constructor: undefined,
      factory: undefined
    } as ServiceDefinition<T>);
  }

  /**
   * Register a service class (will be instantiated when needed)
   */
  registerClass<T>(
    name: string, 
    constructor: ServiceConstructor<T>, 
    dependencies: string[] = [],
    singleton: boolean = true
  ): void {
    this.register(name, { 
      constructor, 
      dependencies, 
      singleton,
      instance: undefined,
      factory: undefined
    } as ServiceDefinition<T>);
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(
    name: string, 
    factory: ServiceFactory<T>, 
    dependencies: string[] = [],
    singleton: boolean = true
  ): void {
    this.register(name, { 
      factory, 
      dependencies, 
      singleton,
      constructor: undefined,
      instance: undefined
    } as ServiceDefinition<T>);
  }

  /**
   * Get a service instance from the container
   */
  get<T>(name: string): T {
    // Check for circular dependency
    if (this.isResolving.has(name)) {
      throw new Error(`[DIContainer] Circular dependency detected: ${name}`);
    }

    // Return existing singleton instance
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    const definition = this.services.get(name);
    if (!definition) {
      throw new Error(`[DIContainer] Service '${name}' not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
    }

    this.isResolving.add(name);

    try {
      let instance: T;

      if (definition.instance) {
        instance = definition.instance;
      } else if (definition.factory) {
        instance = definition.factory();
      } else if (definition.constructor) {
        // Resolve dependencies
        const dependencies = (definition.dependencies || []).map(dep => this.get(dep));
        instance = new definition.constructor(...dependencies);
      } else {
        throw new Error(`[DIContainer] Invalid service definition for '${name}'`);
      }

      // Store singleton instances
      if (definition.singleton) {
        this.instances.set(name, instance);
      }

      return instance;
    } finally {
      this.isResolving.delete(name);
    }
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
    this.isResolving.clear();
  }

  /**
   * Create a new child scope that inherits from this container
   * Useful for testing with mocked services
   */
  createScope(): DIContainer {
    const scope = new DIContainer();
    
    // Copy all service definitions
    for (const [name, definition] of this.services) {
      scope.services.set(name, { ...definition });
    }
    
    // Copy singleton instances (they will be shared)
    for (const [name, instance] of this.instances) {
      scope.instances.set(name, instance);
    }
    
    return scope;
  }

  /**
   * Replace a service in this container (useful for testing)
   */
  mock<T>(name: string, mockInstance: T): void {
    if (!this.services.has(name)) {
      throw new Error(`[DIContainer] Cannot mock non-existent service '${name}'`);
    }
    
    this.instances.set(name, mockInstance);
  }

  /**
   * Get service definition (for debugging)
   */
  getDefinition(name: string): ServiceDefinition | undefined {
    return this.services.get(name);
  }

  /**
   * Health check - validates all registered services can be instantiated
   */
  async validateServices(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const serviceNames = this.getServiceNames();
    
    for (const name of serviceNames) {
      try {
        await this.get(name);
      } catch (error) {
        errors.push(`Service '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }
}

// Create default container instance
export const container = new DIContainer();

// DIContainer class is already exported above