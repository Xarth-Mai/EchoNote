import { ViewPlugin, Decoration, WidgetType, keymap, type ViewUpdate, type DecorationSet, EditorView } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { invokeAiAutocomplete } from "$utils/backend";
import { getActiveAiInvokePayload } from "$utils/ai";

class GhostWidget extends WidgetType {
    constructor(readonly text: string) { super(); }
    toDOM() {
        let span = document.createElement("span");
        span.className = "cm-ghost-text";
        span.textContent = this.text;
        span.style.opacity = "0.5";
        span.style.color = "var(--color-primary, #6b7280)";
        span.style.pointerEvents = "none";
        span.style.fontStyle = "italic";
        return span;
    }
}

export const setGhostText = StateEffect.define<{text: string, pos: number} | null>();

export const ghostTextState = StateField.define<DecorationSet>({
    create() { return Decoration.none; },
    update(decorations, tr) {
        decorations = decorations.map(tr.changes);
        for (let e of tr.effects) {
            if (e.is(setGhostText)) {
                if (e.value === null) {
                    return Decoration.none;
                }
                return Decoration.set([
                    Decoration.widget({
                        widget: new GhostWidget(e.value.text),
                        side: 1
                    }).range(e.value.pos)
                ]);
            }
        }
        if (tr.docChanged) {
            return Decoration.none;
        }
        return decorations;
    },
    provide: f => EditorView.decorations.from(f)
});

export const ghostTextPlugin = ViewPlugin.fromClass(class {
    timer: number | null = null;

    constructor(readonly view: EditorView) {}

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
            this.clearTimer();
            // 立即清除当前的幽灵文本
            update.view.dispatch({ effects: setGhostText.of(null) });

            const pos = update.state.selection.main.head;
            if (update.state.doc.length > 0 && update.state.selection.main.empty) {
                // 等待 1500 毫秒后请求补全
                this.timer = window.setTimeout(() => this.requestAutocomplete(update.view, pos), 1000);
            }
        }
    }

    clearTimer() {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    async requestAutocomplete(view: EditorView, pos: number) {
        const payload = await getActiveAiInvokePayload();
        if (!payload || payload.providerId === "noai") return;

        const doc = view.state.doc.toString();
        // 如果光标不在行尾或者内容中间，则不提示（此处只做最简单的判定：前缀后缀至少有内容或是空行）
        const prefix = doc.slice(Math.max(0, pos - 500), pos); // 截取光标前500字符
        const suffix = doc.slice(pos, Math.min(doc.length, pos + 500)); // 光标后500字符

        try {
            const result = await invokeAiAutocomplete(payload, prefix, suffix);
            const trimResult = result.trim();
            if (trimResult && trimResult.length > 0) {
                 if (view.state.selection.main.head === pos) {
                      view.dispatch({ effects: setGhostText.of({ text: trimResult, pos }) });
                 }
            }
        } catch (e) {
            console.warn("Autocomplete failed", e);
        }
    }

    destroy() {
        this.clearTimer();
    }
});

export const ghostTextKeymap = keymap.of([{
    key: "Tab",
    run: (view) => {
        let hasGhost = false;
        let ghostText = "";
        let pos = view.state.selection.main.head;

        view.state.field(ghostTextState, false)?.between(pos, pos, (from, to, value) => {
             hasGhost = true;
             ghostText = (value.spec.widget as GhostWidget).text;
        });

        if (hasGhost) {
             view.dispatch({
                changes: { from: pos, insert: ghostText },
                selection: { anchor: pos + ghostText.length },
                effects: setGhostText.of(null)
             });
             return true;
        }
        return false;
    }
}]);
