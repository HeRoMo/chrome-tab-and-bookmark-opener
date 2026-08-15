// Minimal JXA (JavaScript for Automation) global type declarations.
// There is no official @types package; this covers only what this
// workflow actually uses.

declare function Application(name: string): any;

declare namespace Application {
  function currentApplication(): {
    includeStandardAdditions: boolean;
    doShellScript(command: string): string;
  };
}

declare const ObjC: {
  import: (framework: string) => void;
  [key: string]: any;
};

declare const $: any;

declare function delay(seconds: number): void;

/**
 * Alfred calls the top-level `run(argv)` function of a JXA script.
 * Script Filters expect a JSON string (Alfred Script Filter JSON format)
 * as the return value; Run Script actions can return anything or nothing.
 */
declare function run(argv: string[]): string | void;
