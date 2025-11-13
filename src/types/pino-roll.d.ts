/**
 * Type declaration for pino-roll
 * pino-roll doesn't include TypeScript types
 */
declare module "pino-roll" {
  import type { DestinationStream } from "pino";

  interface PinoRollOptions {
    file: string;
    frequency?: string | number;
    size?: string;
    limit?: {
      count?: number;
    };
  }

  function build(options: PinoRollOptions): DestinationStream;

  export default build;
}
