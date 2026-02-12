import { TypeTagSerializer } from '@mysten/sui/bcs';
import { logger } from './logger';

/**
 * Normalizes type arguments using Sui SDK TypeTagSerializer
 * Converts shortened addresses to full 64-character hex format
 * 
 * @param typeArgs Array of type argument strings
 * @returns Normalized type argument strings
 */
export function normalizeTypeArguments(typeArgs: string[]): string[] {
  return typeArgs.map((typeArg) => {
    try {
      // Parse and normalize the type tag
      const parsed = TypeTagSerializer.parseFromStr(typeArg, true);
      const normalized = TypeTagSerializer.tagToString(parsed);
      
      if (normalized !== typeArg) {
        logger.debug(`Type arg normalized: ${typeArg} -> ${normalized}`);
      }
      
      return normalized;
    } catch (error) {
      // If parsing fails, return original - let the chain handle it
      logger.warn(`Failed to normalize type arg "${typeArg}": ${(error as Error).message}`);
      return typeArg;
    }
  });
}

/**
 * Checks if an error is related to type argument parsing
 * 
 * Known error patterns from Sui blockchain:
 * - "unexpected token when parsing type args"
 * - "invalid type tag"
 * - "type arg" / "typearg"
 * - "type parameter"
 * 
 * Note: This uses string matching as the Sui SDK doesn't provide typed errors.
 * These patterns are based on actual error messages from the Sui blockchain.
 */
export function isTypeArgError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('type arg') ||
    message.includes('typearg') ||
    message.includes('type parameter') ||
    message.includes('unexpected token when parsing') ||
    message.includes('invalid type tag')
  );
}
