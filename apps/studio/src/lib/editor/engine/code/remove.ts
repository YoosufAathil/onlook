import type { ActionElement, ActionElementLocation } from '/common/models/actions';
import { CodeActionType, type CodeRemove } from '/common/models/actions/code';

export function getRemovedElement(
    location: ActionElementLocation,
    element: ActionElement,
): CodeRemove {
    const removedElement: CodeRemove = {
        type: CodeActionType.REMOVE,
        location,
        uuid: element.uuid,
    };
    return removedElement;
}
