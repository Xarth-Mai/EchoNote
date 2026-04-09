import { ViewPlugin, Decoration, type DecorationSet, EditorView, type ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { hoverTooltip } from "@codemirror/view";
import { invokeAiGrammarCheck } from "$utils/backend";
import { getActiveAiInvokePayload } from "$utils/ai";
import type { GrammarCorrection } from "../../../types";

export interface GrammarCorrectionPos extends GrammarCorrection {
    from: number;
    to: number;
}

export const setGrammarErrors = StateEffect.define<GrammarCorrectionPos[]>();

export const grammarState = StateField.define<DecorationSet>({
    create() { return Decoration.none; },
    update(decorations, tr) {
        decorations = decorations.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setGrammarErrors)) {
                let decos = e.value.map(err => {
                    return Decoration.mark({
                        class: "cm-grammar-error",
                        attributes: { title: err.explanation },
                        spec: { grammarData: err }
                    }).range(err.from, err.to);
                });
                // Sort the decorations by 'from' to satisfy CodeMirror requirements
                decos.sort((a, b) => a.from - b.from);
                return Decoration.set(decos, true);
            }
        }
        return decorations;
    },
    provide: f => EditorView.decorations.from(f)
});

export const grammarCheckPlugin = ViewPlugin.fromClass(class {
    timer: number | null = null;
    lastCheckedText: string = "";

    constructor(readonly view: EditorView) {
        // Initial check
        this.timer = window.setTimeout(() => this.runCheck(view), 2000);
    }

    update(update: ViewUpdate) {
        if (update.docChanged) {
            if (this.timer !== null) window.clearTimeout(this.timer);
            // Debounce a long time for grammar check to save API calls
            this.timer = window.setTimeout(() => this.runCheck(update.view), 5000);
        }
    }

    async runCheck(view: EditorView) {
        const payload = await getActiveAiInvokePayload();
        if (!payload || payload.providerId === "noai") {
            view.dispatch({ effects: setGrammarErrors.of([]) });
            return;
        }

        const text = view.state.doc.toString();
        if (text.length === 0 || text.length > 5000 || text === this.lastCheckedText) return;
        this.lastCheckedText = text;

        try {
            const result = await invokeAiGrammarCheck(payload, text);
            let errors: GrammarCorrectionPos[] = [];
            for (const err of result) {
                 if (!err.original) continue;
                 let idx = text.indexOf(err.original);
                 while (idx !== -1) {
                     errors.push({ ...err, from: idx, to: idx + err.original.length });
                     idx = text.indexOf(err.original, idx + err.original.length);
                 }
            }
            view.dispatch({ effects: setGrammarErrors.of(errors) });
        } catch(e) {
            console.warn("Grammar check failed", e);
        }
    }
    
    destroy() {
        if (this.timer !== null) window.clearTimeout(this.timer);
    }
});

export const grammarTooltip = hoverTooltip((view, pos, side) => {
    const decos = view.state.field(grammarState, false);
    if (!decos) return null;

    let found: GrammarCorrectionPos | null = null;
    decos.between(pos, pos, (from, to, value) => {
        if (value.spec.grammarData) {
            found = value.spec.grammarData;
        }
    });

    if (!found) return null;
    const data = found as GrammarCorrectionPos;

    return {
        pos: data.from,
        end: data.to,
        above: true,
        create(view) {
            let dom = document.createElement("div");
            dom.className = "cm-grammar-tooltip";
            let span = document.createElement("strong");
            span.textContent = data.suggestion;
            span.style.color = "var(--color-primary, #3b82f6)";
            span.style.cursor = "pointer";
            span.onclick = () => {
                view.dispatch({
                    changes: { from: data.from, to: data.to, insert: data.suggestion }
                });
            };
            
            let expl = document.createElement("div");
            expl.textContent = data.explanation;
            expl.style.fontSize = "0.85em";
            expl.style.color = "var(--color-text-muted, #6b7280)";

            dom.appendChild(span);
            dom.appendChild(expl);
            return { dom };
        }
    };
});
