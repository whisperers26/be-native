import * as _llm7 from './llm7';
import * as _openai from './openai';
import * as _claude_code from './claude_code';
import * as _codex from './codex';
import type { WritingService } from '../../types/service';

// `satisfies` checks each module against the contract in src/types/service.ts and emits nothing.
export const llm7 = _llm7 satisfies WritingService;
export const openai = _openai satisfies WritingService;
export const claude_code = _claude_code satisfies WritingService;
export const codex = _codex satisfies WritingService;
