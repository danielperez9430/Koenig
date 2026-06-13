import {addCreateDocumentOption} from '../../utils/add-create-document-option.js';
import type {ExportDOMOptions, ExportDOMOutput} from '../../export-dom.js';
import {renderTemplate} from './plugin-card-template.js';
import {scopeCss} from './plugin-card-css.js';

interface PluginCardNodeData {
    html?: string;
    pluginName?: string;
    cardName?: string;
    payload?: string;
    css?: string;
    template?: string;
}

interface RenderOptions extends ExportDOMOptions {}

function parsePayload(raw: any): Record<string, any> {
    if (typeof raw === 'object' && raw !== null) {
        return raw as Record<string, any>;
    }
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw || '{}');
        } catch {
            try {
                return JSON.parse((raw || '{}').replace(/\\"/g, '"'));
            } catch {
                return {};
            }
        }
    }
    return {};
}

/**
 * Adds data-ghost-* attributes to the root element of rendered HTML
 * so that the plugin-card-parser can re-create PluginCardNodes on re-import.
 */
function addDataAttributes(html: string, pluginName: string, cardName: string, payload: Record<string, any>): string {
    const payloadStr = JSON.stringify(payload).replace(/"/g, '&quot;');

    // Find the first HTML element and add attributes
    const tagMatch = html.match(/<(\w+)([^>]*)>/);
    if (tagMatch) {
        const tagName = tagMatch[1];
        const existingAttrs = tagMatch[2];
        const dataAttrs = ` data-ghost-plugin="${pluginName}" data-card-name="${cardName}" data-ghost-payload='${payloadStr}'`;
        return html.replace(
            new RegExp(`<${tagName}([^>]*)>`),
            `<${tagName}${existingAttrs}${dataAttrs}>`
        );
    }

    return html;
}

export function renderPluginCardNode(node: PluginCardNodeData, options: RenderOptions = {}): ExportDOMOutput<'value'> {
    addCreateDocumentOption(options);
    const document = options.createDocument!();

    const payload = parsePayload(node.payload || '{}');

    // Use the plugin's Handlebars template if available, fallback to
    // pre-rendered html or an empty placeholder
    let renderedHtml: string;
    if (node.template) {
        try {
            renderedHtml = renderTemplate(node.template, payload);
        } catch {
            renderedHtml = node.html || '<div class="plugin-card-empty">Plugin card (render error)</div>';
        }
    } else if (node.html) {
        renderedHtml = node.html;
    } else {
        renderedHtml = '<div class="plugin-card-empty">Plugin card (no template)</div>';
    }

    // Wrap in namespace container so scoped CSS applies
    const namespace = `plugin-${node.pluginName || 'unknown'}`;
    renderedHtml = `<div class="${namespace}">\n${renderedHtml}\n</div>`;

    // Add data attributes for re-import via plugin-card-parser
    renderedHtml = addDataAttributes(
        renderedHtml,
        node.pluginName || '',
        node.cardName || '',
        payload
    );

    // Include CSS scoped to the plugin namespace
    const css = scopeCss(node.css || '', namespace);
    const styleTag = css ? `<style>${css}</style>` : '';

    const wrappedHtml = `\n<!--kg-card-begin: plugin-card-->\n${styleTag}${renderedHtml}\n<!--kg-card-end: plugin-card-->\n`;

    const textarea = document.createElement('textarea');
    textarea.value = wrappedHtml;
    return {element: textarea, type: 'value' as const};
}
