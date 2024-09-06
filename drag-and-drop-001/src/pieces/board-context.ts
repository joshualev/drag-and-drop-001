import { createContext, useContext } from 'react';

import invariant from 'tiny-invariant';

import type { CleanupFn } from '@atlaskit/pragmatic-drag-and-drop/types';

import type { ColumnType } from '../data/people';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
export type BoardContextValue = {
	getColumns: () => ColumnType[];

	reorderColumn: (args: { startIndex: number; finishIndex: number, closestEdgeOfTarget: Edge }) => void;

	reorderCard: (args: { columnId: string; startIndex: number; finishIndex: number, closestEdgeOfTarget: Edge }) => void;

	moveCard: (args: {
		startColumnId: string;
		finishColumnId: string;
		itemIndexInStartColumn: number;
		itemIndexInFinishColumn?: number;
	}) => void;

	registerCard: (args: {
		cardId: string;
		entry: {
			element: HTMLElement;
			actionMenuTrigger: HTMLElement;
		};
	}) => CleanupFn;

	registerColumn: (args: {
		columnId: string;
		entry: {
			element: HTMLElement;
		};
	}) => CleanupFn;

	instanceId: symbol;
};

export const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoardContext(): BoardContextValue {
	const value = useContext(BoardContext);
	invariant(value, 'cannot find BoardContext provider');
	return value;
}