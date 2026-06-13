import React from 'react';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$getNodeByKey} from 'lexical';
import {renderTemplate, scopeCss} from '@tryghost/kg-default-nodes';

// Inject CSS into <head> so the editor applies custom class styles
function useInjectStyles(pluginName, css) {
    React.useEffect(() => {
        if (!css) return;
        const namespace = `plugin-${pluginName}`;
        const scopedCss = scopeCss(css, namespace);
        const styleId = `plugin-card-css-${pluginName}`;
        let el = document.getElementById(styleId);
        if (!el) {
            el = document.createElement('style');
            el.id = styleId;
            document.head.appendChild(el);
        }
        el.textContent = scopedCss;
        return () => {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        };
    }, [pluginName, css]);
}

export const PluginCardNodeComponent = ({html: initialHtml, cardName, nodeKey, payload: initialPayload, pluginName}) => {
    const [editor] = useLexicalComposerContext();
    const [isEditing, setIsEditing] = React.useState(false);
    const [rawPayload, setRawPayload] = React.useState(() => {
        try {
            const p = initialPayload || '{}';
            return typeof p === 'object' ? p : JSON.parse(p);
        } catch {
            return {};
        }
    });
    const [cardDef, setCardDef] = React.useState(null);
    const [pluginCss, setPluginCss] = React.useState('');

    useInjectStyles(pluginName, pluginCss);

    React.useEffect(() => {
        fetch('/ghost/api/admin/plugins/cards/', {credentials: 'include'})
            .then(r => r.json())
            .then(data => {
                const cards = data.plugins?.flat() || [];
                const found = cards.find(c => c.plugin === pluginName && c.name === cardName);
                if (found) {
                    setCardDef(found);
                    if (found.css) {
                        setPluginCss(found.css);
                    }
                    // Persist template on the node for exportDOM rendering
                    if (found.template) {
                        editor.update(() => {
                            const node = $getNodeByKey(nodeKey);
                            if (node) {
                                if (!node.css && found.css) {
                                    node.css = found.css;
                                }
                                if (!node.template) {
                                    node.template = found.template;
                                }
                            }
                        });
                    }
                }
            }).catch(() => {});
    }, [pluginName, cardName]);

    const handleSave = (newRawPayload) => {
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (node) {
                node.payload = newRawPayload;
                node.pluginName = pluginName;
                node.cardName = cardName;
            }
        });
        setRawPayload(newRawPayload);
        setIsEditing(false);
    };

    const getFieldValue = (field) => {
        const val = rawPayload[field.key];
        return val !== undefined ? val : (field.default || '');
    };

    // View mode HTML — computed unconditionally to keep hook count stable
    const template = cardDef?.template || '';
    const renderedHtml = React.useMemo(() => {
        if (!template) return '<div class="review-card"><div class="p-4 text-sm text-grey-500">No template loaded</div></div>';
        try {
            return renderTemplate(template, rawPayload);
        } catch (e) {
            return `<div class="review-card"><div class="p-4 text-sm text-red">Render error: ${e.message}</div></div>`;
        }
    }, [template, rawPayload]);

    // Edit mode
    if (isEditing) {
        if (!cardDef) {
            return <div className="p-4 text-sm text-grey-500">Loading...</div>;
        }
        return (
            <div className="rounded-lg border border-grey-300 bg-white p-4 dark:border-dark-600 dark:bg-dark-bg">
                <h3 className="mb-4 text-sm font-semibold">{cardDef.label}</h3>
                <div className="space-y-3">
                    {cardDef.fields.map((field) => (
                        <div key={field.key}>
                            <label className="mb-1 block text-xs font-medium text-grey-600 dark:text-grey-400">{field.title}</label>
                            {field.type === 'textarea' ? (
                                <textarea className="w-full rounded border border-grey-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-200" rows={3}
                                    value={getFieldValue(field)}
                                    onChange={(e) => setRawPayload(prev => ({...prev, [field.key]: e.target.value}))} />
                            ) : field.type === 'number' ? (
                                <input className="w-full rounded border border-grey-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-200"
                                    max={field.max} min={field.min} step={field.step} type="number"
                                    value={getFieldValue(field)}
                                    onChange={(e) => setRawPayload(prev => ({...prev, [field.key]: parseFloat(e.target.value)}))} />
                            ) : (
                                <input className="w-full rounded border border-grey-300 px-3 py-2 text-sm dark:border-dark-600 dark:bg-dark-200"
                                    type="text" value={getFieldValue(field)}
                                    onChange={(e) => setRawPayload(prev => ({...prev, [field.key]: e.target.value}))} />
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex gap-2">
                    <button className="rounded bg-grey-200 px-3 py-1.5 text-sm dark:bg-dark-200" onClick={() => setIsEditing(false)}>Cancel</button>
                    <button className="rounded bg-green px-3 py-1.5 text-sm text-white" onClick={() => handleSave(rawPayload)}>Save</button>
                </div>
            </div>
        );
    }

    // View mode — rendered HTML inside a plugin-namespaced container
    return (
        <div className="group relative cursor-pointer" onClick={() => setIsEditing(true)}>
            <div className={`plugin-${pluginName} not-kg-prose`} dangerouslySetInnerHTML={{__html: renderedHtml}} />
            <button className="absolute right-2 top-2 rounded bg-grey-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">Edit</button>
        </div>
    );
};
