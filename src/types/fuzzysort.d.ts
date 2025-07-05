// Type declarations for fuzzysort
declare module 'fuzzysort' {
  interface Options {
    threshold?: number;
    limit?: number;
    all?: boolean;
    key?: string | string[];
  }

  interface Result {
    obj: any;
    score: number;
    indexes: number[];
    target: string;
  }

  interface Prepared {
    target: string;
    _score: number;
    _indexes: number[];
  }

  interface FuzzySort {
    go(query: string, targets: any[], options?: Options): Result[];
    goAsync(query: string, targets: any[], options?: Options): Promise<Result[]>;
    prepare(target: string): Prepared;
    cleanup(): void;
  }

  const fuzzysort: FuzzySort;
  export default fuzzysort;
}

// PrimeVue module declarations
declare module 'primevue/config' {
  import { Plugin } from 'vue';
  const PrimeVue: Plugin;
  export default PrimeVue;
}

declare module '@primevue/themes/aura' {
  const Aura: any;
  export default Aura;
}

declare module 'primevue/styleclass' {
  import { Directive } from 'vue';
  const StyleClass: Directive;
  export default StyleClass;
}

declare module 'primevue/multiselect' {
  import { DefineComponent } from 'vue';
  const MultiSelect: DefineComponent<any, any, any>;
  export default MultiSelect;
}

// Axios module declaration
declare module 'axios' {
  export interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    timeout?: number;
    headers?: any;
    params?: any;
    data?: any;
    responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
    validateStatus?: (status: number) => boolean;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
  }

  export interface AxiosInstance {
    (config: AxiosRequestConfig): Promise<AxiosResponse>;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    defaults: {
      timeout: number;
      headers: any;
    };
    interceptors: {
      request: {
        use(onFulfilled: (config: AxiosRequestConfig) => AxiosRequestConfig): number;
      };
      response: {
        use(onFulfilled: (response: AxiosResponse) => AxiosResponse): number;
      };
    };
  }

  export interface AxiosStatic extends AxiosInstance {
    create(config?: AxiosRequestConfig): AxiosInstance;
  }

  declare const axios: AxiosStatic;
  export default axios;
  export { AxiosInstance, AxiosRequestConfig, AxiosResponse };
}

// Cheerio module declaration
declare module 'cheerio' {
  export interface CheerioAPI {
    (selector: string): any;
    load(html: string): CheerioAPI;
  }

  export function load(html: string): CheerioAPI;
  export default load;
}