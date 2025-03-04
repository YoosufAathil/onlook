import { colors } from '@onlook/ui/tokens';

import { EditorMode } from '@/lib/models';
import { nanoid } from 'nanoid';
import type React from 'react';
import type { EditorEngine } from '..';
import { EditorAttributes } from '/common/constants';
import type {
    ActionElement,
    ActionElementLocation,
    ActionTarget,
    InsertElementAction,
} from '/common/models/actions';
import type { ElementPosition } from '/common/models/element';

export class InsertManager {
    isDrawing = false;
    private drawOrigin: { overlay: ElementPosition; webview: ElementPosition } | undefined;

    constructor(private editorEngine: EditorEngine) {}

    start(
        e: React.MouseEvent<HTMLDivElement>,
        getRelativeMousePositionToOverlay: (e: React.MouseEvent<HTMLDivElement>) => ElementPosition,
        getRelativeMousePositionToWebview: (e: React.MouseEvent<HTMLDivElement>) => ElementPosition,
    ) {
        this.isDrawing = true;
        const overlayPos = getRelativeMousePositionToOverlay(e);
        const webviewPos = getRelativeMousePositionToWebview(e);
        this.drawOrigin = { overlay: overlayPos, webview: webviewPos };
        this.updateInsertRect(overlayPos);
    }

    draw(
        e: React.MouseEvent<HTMLDivElement>,
        getRelativeMousePositionToOverlay: (e: React.MouseEvent<HTMLDivElement>) => ElementPosition,
    ) {
        if (!this.isDrawing || !this.drawOrigin) {
            return;
        }

        const currentPos = getRelativeMousePositionToOverlay(e);
        const newRect = this.getDrawRect(this.drawOrigin.overlay, currentPos);
        this.editorEngine.overlay.updateInsertRect(newRect);
    }

    end(
        e: React.MouseEvent<HTMLDivElement>,
        webview: Electron.WebviewTag | null,
        getRelativeMousePositionToWebview: (e: React.MouseEvent<HTMLDivElement>) => ElementPosition,
    ) {
        if (!this.isDrawing || !this.drawOrigin) {
            return null;
        }

        this.isDrawing = false;
        this.editorEngine.overlay.removeInsertRect();

        const webviewPos = getRelativeMousePositionToWebview(e);
        const newRect = this.getDrawRect(this.drawOrigin.webview, webviewPos);
        if (!webview) {
            console.error('Webview not found');
            return;
        }

        if (
            this.editorEngine.mode === EditorMode.INSERT_TEXT &&
            newRect.width < 10 &&
            newRect.height < 10
        ) {
            this.editorEngine.text.editElementAtLoc(this.drawOrigin.webview, webview);
            this.drawOrigin = undefined;
            return;
        }
        this.insertElement(webview, newRect);
        this.drawOrigin = undefined;
    }

    private updateInsertRect(pos: ElementPosition) {
        const { x, y } = pos;
        const rect = new DOMRect(x, y, 0, 0);
        this.editorEngine.overlay.updateInsertRect(rect);
    }

    private getDrawRect(drawStart: ElementPosition, currentPos: ElementPosition): DOMRect {
        const { x, y } = currentPos;
        let startX = drawStart.x;
        let startY = drawStart.y;
        let width = x - startX;
        let height = y - startY;

        if (width < 0) {
            startX = x;
            width = Math.abs(width);
        }

        if (height < 0) {
            startY = y;
            height = Math.abs(height);
        }

        return new DOMRect(startX, startY, width, height);
    }

    async insertElement(
        webview: Electron.WebviewTag,
        newRect: { x: number; y: number; width: number; height: number },
    ) {
        const insertAction = await this.createInsertAction(webview, newRect);
        if (!insertAction) {
            console.error('Failed to create insert action');
            return;
        }
        this.editorEngine.action.run(insertAction);
    }

    async createInsertAction(
        webview: Electron.WebviewTag,
        newRect: { x: number; y: number; width: number; height: number },
    ): Promise<InsertElementAction | undefined> {
        const location: ActionElementLocation | undefined = await webview.executeJavaScript(
            `window.api?.getInsertLocation(${this.drawOrigin?.webview.x}, ${this.drawOrigin?.webview.y})`,
        );
        if (!location) {
            console.error('Insert position not found');
            return;
        }
        const mode = this.editorEngine.mode;
        const uuid = nanoid();
        const selector = `[${EditorAttributes.DATA_ONLOOK_UNIQUE_ID}="${uuid}"]`;
        const width = Math.max(Math.round(newRect.width), 30);
        const height = Math.max(Math.round(newRect.height), 30);
        const styles: Record<string, string> =
            mode === EditorMode.INSERT_TEXT
                ? {
                      width: `${width}px`,
                      height: `${height}px`,
                  }
                : {
                      width: `${width}px`,
                      height: `${height}px`,
                      backgroundColor: colors.blue[100],
                  };

        const actionElement: ActionElement = {
            selector: selector,
            tagName: mode === EditorMode.INSERT_TEXT ? 'p' : 'div',
            attributes: {
                [EditorAttributes.DATA_ONLOOK_UNIQUE_ID]: uuid,
                [EditorAttributes.DATA_ONLOOK_INSERTED]: 'true',
            },
            children: [],
            textContent: '',
            styles,
            uuid,
        };

        const targets: Array<ActionTarget> = [
            {
                webviewId: webview.id,
                selector: uuid,
                uuid: uuid,
            },
        ];

        return {
            type: 'insert-element',
            targets: targets,
            location: location,
            element: actionElement,
            editText: mode === EditorMode.INSERT_TEXT,
        };
    }
}
