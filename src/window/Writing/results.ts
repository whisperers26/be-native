// Which result boxes the Writing window shows, and in what order. Each box is one request to one service.
import type { ServiceConfigMap } from '../../types/service';
import type { Tone } from '../../utils/writing_tones';

export interface ResultSpec {
    /** Unique among the boxes the window shows for one text. */
    id: string;
    /** The service instance that is asked. */
    service: string;
    /** What the box is labelled with besides its service: the tone's name, or the user's request. */
    label?: string;
    style?: string;
    request?: string;
}

/** The instances that are switched on, in the order of the list. */
export function enabledServices(list: string[], configs: ServiceConfigMap): string[] {
    return list.filter((key) => (configs[key] ?? {})['enable'] ?? true);
}

/** The default improvement, from each service. */
export function defaultResults(services: string[]): ResultSpec[] {
    return services.map((service) => ({ id: `default/${service}`, service }));
}

/** Every tone from every service, tone by tone: all services' first tone, then all services' second one. */
export function toneResults(tones: Tone[], services: string[]): ResultSpec[] {
    return tones.flatMap((tone, index) =>
        services.map((service) => ({
            id: `tone/${index}/${service}`,
            service,
            label: tone.name,
            style: tone.instruction,
        }))
    );
}

/** The user's own request, from each service. `round` counts the requests made, so that a repeated one is new. */
export function customResults(request: string, services: string[], round: number): ResultSpec[] {
    return services.map((service) => ({ id: `custom/${round}/${service}`, service, label: request, request }));
}
