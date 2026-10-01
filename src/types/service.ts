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

export interface WritingOptions {
    config: ServiceConfig;
    /** How the result should read: a tone's instruction. */
    style?: string;
    /** The user's own extra request. */
    request?: string;
    setResult?: (partial: string) => void;
    /** Aborted when the rewrite is no longer wanted. A service that makes its requests wait their turn checks it. */
    signal?: AbortSignal;
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

/**
 * What a built-in service module exports. `Members` adds what its kind needs: the main function, and
 * `Language` for every kind but collection. Each registry checks its modules against it with `satisfies`.
 */
export type ServiceModule<Members> = { info: ServiceInfo; Config: ServiceConfigComponent } & Members;

/*
 * What every module in each registry provides (docs/agents/services.md). A registry checks its modules against its
 * contract with `satisfies`; a window that looks a service up by a name known only at run time casts the registry to
 * `Record<string, <Kind>Service>`.
 */
export type TranslateService = ServiceModule<{
    Language: Record<string, string>;
    translate: (text: string, from: string, to: string, options: TranslateOptions) => Promise<TranslateResult>;
}>;

export type RecognizeService = ServiceModule<{
    Language: Record<string, string>;
    recognize: (base64: string, language: string, options: RecognizeOptions) => Promise<string | undefined>;
}>;

export type TtsService = ServiceModule<{
    Language: Record<string, string>;
    tts: (text: string, lang: string, options: TtsOptions) => Promise<number[] | undefined>;
}>;

// Collection services have no Language.
export type CollectionService = ServiceModule<{
    collection: (source: string, target: TranslateResult, options: CollectionOptions) => Promise<unknown>;
}>;

// Writing services have no Language: the rewrite stays in the language of the text.
export type WritingService = ServiceModule<{
    improve: (text: string, options: WritingOptions) => Promise<string>;
}>;

/** What the Translate window reads from a plugin's info.json (docs/agents/services.md). */
export interface PluginInfo {
    display: string;
    icon?: string;
    /** App language code to the plugin's own code. Collection plugins have none, and nothing reads it for them. */
    language: Record<string, string>;
}

/** The installed plugins, by kind (`translate`, `tts`, `recognize`, `collection`) and then by plugin name. */
export type PluginList = Record<string, Record<string, PluginInfo>>;

/**
 * One setting that a plugin's info.json asks for (`needs`). The plugin settings form shows an input for no `type` or
 * `input`, and a dropdown over `options` for `select`.
 */
export type PluginNeed =
    | { key: string; display: string; type?: 'input' }
    | { key: string; display: string; type: 'select'; options: Record<string, string> };

/**
 * What the Service settings page reads from a plugin's info.json on top of PluginInfo: the homepage and the settings
 * its form asks for.
 */
export interface PluginConfigInfo extends PluginInfo {
    homepage: string;
    needs: PluginNeed[];
}

/** The installed plugins as the Service settings page loads them, by kind and then by plugin name. */
export type PluginConfigList = Record<string, Record<string, PluginConfigInfo>>;

/** The settings of each service instance in use, by instance key. */
export type ServiceConfigMap = Record<string, ServiceConfig>;
