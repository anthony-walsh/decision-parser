/**
 * HTTP Client Service
 * 
 * Handles all HTTP requests with security enhancements, timeout management,
 * and error handling. Follows Single Responsibility Principle.
 * 
 * AIDEV-NOTE: Focused HTTP client for appeal scraping with security
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getEnvironmentConfig } from '@/utils/environment.js';
import type { IHttpClient } from './interfaces.js';

export class HttpClient implements IHttpClient {
  private axiosClient!: AxiosInstance;
  private timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
    this.setupAxiosClient();
  }

  private setupAxiosClient(): void {
    const envConfig = getEnvironmentConfig();
    
    this.axiosClient = axios.create({
      timeout: this.timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // AIDEV-NOTE: Security enhancement - enforce HTTPS in production
    if (envConfig.enforceHttps) {
      this.axiosClient.interceptors.request.use((config: AxiosRequestConfig) => {
        if (config.url && config.url.startsWith('http://')) {
          console.warn('[HttpClient][SECURITY] Converting HTTP to HTTPS:', config.url);
          config.url = config.url.replace('http://', 'https://');
        }
        return config;
      });
    }
  }

  async get(url: string, options: AxiosRequestConfig = {}): Promise<any> {
    try {
      const response = await this.axiosClient.get(url, {
        timeout: this.timeoutMs,
        ...options
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP GET failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async download(url: string): Promise<ArrayBuffer> {
    try {
      const response = await this.axiosClient.get(url, {
        responseType: 'arraybuffer',
        timeout: this.timeoutMs
      });
      return response.data;
    } catch (error) {
      throw new Error(`Download failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  setHeaders(headers: Record<string, string>): void {
    Object.assign(this.axiosClient.defaults.headers, headers);
  }

  setTimeout(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
    this.axiosClient.defaults.timeout = timeoutMs;
  }
}