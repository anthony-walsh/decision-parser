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