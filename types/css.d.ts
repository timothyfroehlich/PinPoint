/// <reference types="next" />

// Global CSS imports (non-modules)
declare module "*.css" {
  const content: string;
  export default content;
}

// Specific TypeScript declarations for our globals.css file
declare module "./globals.css" {
  const content: string;
  export default content;
}

declare module "../globals.css" {
  const content: string;
  export default content;
}

// CSS modules 
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}