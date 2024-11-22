declare module 'input' {
    function text(prompt: string): Promise<string>;
    function select<T>(prompt: string, choices: T[]): Promise<T>;
    function confirm(prompt: string, options?: { default: boolean }): Promise<boolean>;

    export = input;
}