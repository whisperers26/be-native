/** What every built-in service module provides. See docs/agents/services.md. */
import type { ComponentType } from 'react';

export interface ServiceInfo {
    name: string;
    icon: string;
}

/** A service's settings as stored under its instance key. */
export type ServiceConfig = Record<string, any>;

export interface DictionaryResult {
    pronunciations: { region?: string; symbol: string; voice: string | number[] }[];
    explanations: { trait: string; explains: string[] }[];
    /** cambridge_dict leaves this out. */
    associations?: string[];
    /** cambridge_dict leaves this out. */
    sentence?: { source: string; target?: string }[];
}

export type TranslateResult = string | DictionaryResult;

export interface TranslateOptions {
    config: ServiceConfig;
    detect?: string;
    setResult?: (partial: string) => void;
}

export interface RecognizeOptions {
    config: ServiceConfig;
}

export interface TtsOptions {
    config: ServiceConfig;
}

export interface CollectionOptions {
    config: ServiceConfig;
}

export interface ServiceConfigProps {
    name?: string;
    instanceKey: string;
    pluginType?: string;
    pluginList?: Record<string, unknown>;
    updateServiceList: (instanceKey: string) => void;
    onClose: () => void;
}

export type ServiceConfigComponent = ComponentType<ServiceConfigProps>;
