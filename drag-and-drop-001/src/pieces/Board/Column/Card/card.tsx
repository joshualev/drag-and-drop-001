import React, {
	forwardRef,
	type KeyboardEvent,
	memo,
	type MouseEvent,
	type MouseEventHandler,
	useEffect,
	useRef,
	useState,
	useCallback,
} from 'react';

import ReactDOM from 'react-dom';
import invariant from 'tiny-invariant';

import {
	attachClosestEdge,
	type Edge,
	extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { DropIndicator } from '../../../../components/drop-indicator';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';

import { type Person, type ColumnType } from '../../../../data/people';
import { useBoardContext } from '../../../board-context';
import { useColumnContext } from '../column-context';

import { MoreVertical } from 'lucide-react';
type DraggableState =
	| { type: 'idle' }
	| { type: 'preview'; container: HTMLElement; rect: DOMRect }
	| { type: 'is-card-over'; closestEdge: Edge | null }
	| { type: 'dragging' };

const idleState: DraggableState = { type: 'idle' };
const draggingState: DraggableState = { type: 'dragging' };

const stateStyles: {
	[Key in DraggableState['type']]?: string | undefined;
} = {
	dragging: 'opacity-0',
};

const selectedStyles = 'bg-indigo-100';
const draggingStyles = 'opacity-40';

// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const primaryButton = 0;

type CardPrimitiveProps = {
	isDragging?: boolean;
	isSelected: boolean;
	item: Person;
	state: DraggableState;
	onClick?: MouseEventHandler;
};

// 
function MoveToOtherColumnItem({
	targetColumn,
	startIndex,
	onClose,
}: {
	targetColumn: ColumnType;
	startIndex: number;
	onClose: () => void;
}) {
	const { moveCard } = useBoardContext();
	const { columnId } = useColumnContext();

	const onClick = useCallback(() => {
		moveCard({
			startColumnId: columnId,
			finishColumnId: targetColumn.columnId,
			itemIndexInStartColumn: startIndex,
		});
		onClose();
	}, [columnId, moveCard, startIndex, targetColumn.columnId, onClose]);

	return (
		<button
			onClick={onClick}
			className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
			role="menuitem"
		>
			{targetColumn.title}
		</button>
	);
}

function LazyDropdownItems({ userId, onClose }: { userId: string; onClose: () => void }) {
	const { getColumns, reorderCard } = useBoardContext();
	const { columnId, getCardIndex, getNumCards } = useColumnContext();

	const numCards = getNumCards();
	const startIndex = getCardIndex(userId);

	const moveToTop = useCallback(() => {
		reorderCard({ columnId, startIndex, finishIndex: 0, closestEdgeOfTarget: 'top' });
		onClose();
	}, [columnId, reorderCard, startIndex, onClose]);

	const moveUp = useCallback(() => {
		reorderCard({ columnId, startIndex, finishIndex: startIndex - 1, closestEdgeOfTarget: 'top' });
		onClose();
	}, [columnId, reorderCard, startIndex, onClose]);

	const moveDown = useCallback(() => {
		reorderCard({ columnId, startIndex, finishIndex: startIndex + 1, closestEdgeOfTarget: 'bottom' });
		onClose();
	}, [columnId, reorderCard, startIndex, onClose]);

	const moveToBottom = useCallback(() => {
		reorderCard({ columnId, startIndex, finishIndex: numCards - 1, closestEdgeOfTarget: 'bottom' });
		onClose();
	}, [columnId, reorderCard, startIndex, numCards, onClose]);

	const isMoveUpDisabled = startIndex === 0;
	const isMoveDownDisabled = startIndex === numCards - 1;

	const moveColumnOptions = getColumns().filter((column) => column.columnId !== columnId);

	return (
		<div className="py-1" role="menu" aria-orientation="vertical">
			<div className="px-3 py-2 text-xs font-semibold text-gray-500">Reorder</div>
			<button
				onClick={moveToTop}
				disabled={isMoveUpDisabled}
				className={`block w-full text-left px-4 py-2 text-sm ${
					isMoveUpDisabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
				}`}
				role="menuitem"
			>
				Move to top
			</button>
			<button
				onClick={moveUp}
				disabled={isMoveUpDisabled}
				className={`block w-full text-left px-4 py-2 text-sm ${
					isMoveUpDisabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
				}`}
				role="menuitem"
			>
				Move up
			</button>
			<button
				onClick={moveDown}
				disabled={isMoveDownDisabled}
				className={`block w-full text-left px-4 py-2 text-sm ${
					isMoveDownDisabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
				}`}
				role="menuitem"
			>
				Move down
			</button>
			<button
				onClick={moveToBottom}
				disabled={isMoveDownDisabled}
				className={`block w-full text-left px-4 py-2 text-sm ${
					isMoveDownDisabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
				}`}
				role="menuitem"
			>
				Move to bottom
			</button>
			{moveColumnOptions.length > 0 && (
				<>
					<div className="border-t border-gray-100 my-1"></div>
					<div className="px-3 py-2 text-xs font-semibold text-gray-500">Move to</div>
					{moveColumnOptions.map((column) => (
						<MoveToOtherColumnItem
							key={column.columnId}
							targetColumn={column}
							startIndex={startIndex}
							onClose={onClose}
						/>
					))}
				</>
			)}
		</div>
	);
}


const CardPrimitive = forwardRef<HTMLDivElement, CardPrimitiveProps>(function CardPrimitive(
	{ item, isDragging, isSelected, state, onClick },
	ref,
) {
	const { avatarUrl, name, role, userId } = item;

	return (
		<div
			ref={ref}
			data-testid={`item-${userId}`}
			className={`relative grid grid-cols-[auto_1fr_auto] gap-2 items-center p-2 rounded-lg shadow-md bg-white ${stateStyles[state.type]} ${isSelected ? selectedStyles : ''} ${isSelected && isDragging ? draggingStyles : ''}`}
			onClick={onClick}
			role="button"
			tabIndex={0}
		>
			<img src={avatarUrl} alt={`${name}'s avatar`} className="w-12 h-12 rounded-full pointer-events-none" />
			<div className="flex flex-col space-y-1">
				<span className="text-sm font-semibold">{name}</span>
				<span className="text-xs text-gray-500">{role}</span>
			</div>
			{state.type === 'is-card-over' && state.closestEdge && (
				<DropIndicator edge={state.closestEdge} gap='8px' />
			)}
		</div>
	);
});

// Determines if the platform specific toggle selection in group key was used
const wasToggleInSelectionGroupKeyUsed = (event: MouseEvent | KeyboardEvent) => {
	const isUsingWindows = /Win/.test(navigator.userAgent) || /Win/.test(navigator.platform);
	return isUsingWindows ? event.ctrlKey : event.metaKey;
};

// Determines if the multiSelect key was used
const wasMultiSelectKeyUsed = (event: MouseEvent | KeyboardEvent) => event.shiftKey;

type CardProps = {
	item: Person;
	isDragging: boolean;
	isSelected: boolean;
	selectedCount: number;
	multiSelectTo: (id: string) => void;
	toggleSelection: (id: string) => void;
	toggleSelectionInGroup: (id: string) => void;
};

export const Card = memo(function Card({
	item,
	isDragging,
	isSelected,
	selectedCount,
	multiSelectTo,
	toggleSelection,
	toggleSelectionInGroup,
}: CardProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { userId } = item;
	const [state, setState] = useState<DraggableState>(idleState);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const actionMenuTriggerRef = useRef<HTMLButtonElement>(null);

	const { instanceId, registerCard } = useBoardContext();
	useEffect(() => {
		invariant(actionMenuTriggerRef.current);
		invariant(ref.current);
		return registerCard({
			cardId: userId,
			entry: {
				element: ref.current,
				actionMenuTrigger: actionMenuTriggerRef.current,
			},
		});
	}, [registerCard, userId]);

	useEffect(() => {
		invariant(ref.current);
		return combine(
			draggable({
				element: ref.current,
				getInitialData: () => ({ type: 'card', itemId: userId, instanceId }),
				onGenerateDragPreview: ({ location, source, nativeSetDragImage }) => {
					const rect = source.element.getBoundingClientRect();
					setCustomNativeDragPreview({
						nativeSetDragImage,
						getOffset() {
							/**
							 * This offset ensures that the preview is positioned relative to
							 * the cursor based on where you drag from.
							 *
							 * This creates the effect of it being picked up.
							 */
							return {
								x: location.current.input.clientX - rect.x,
								y: location.current.input.clientY - rect.y,
							};
						},
						render({ container }) {
							setState({ type: 'preview', container, rect });
							return () => setState(draggingState);
						},
					});
				},
				onDragStart: () => setState(draggingState),
				onDrop: () => setState(idleState),
			}),
			dropTargetForElements({
				element: ref.current,
				canDrop: ({ source }) => {
					return source.data.instanceId === instanceId && source.data.type === 'card';
				},
				getIsSticky: () => true,
				getData: ({ input, element }) => {
					const data = { type: 'card', itemId: userId };
					return attachClosestEdge(data, {
						input,
						element,
						allowedEdges: ['top', 'bottom'],
					});
				},
				onDragEnter: (args) => {
					if (args.source.data.itemId === userId) {
						return;
					}
					const closestEdge: Edge | null = extractClosestEdge(args.self.data);
					setState({
						type: 'is-card-over',
						closestEdge,
					});
				},
				onDrag: (args) => {
					if (args.source.data.itemId === userId) {
						return;
					}
					const closestEdge: Edge | null = extractClosestEdge(args.self.data);
					// conditionally update react state if change has occurred
					setState((current) => {
						if (current.type !== 'is-card-over') {
							return current;
						}
						if (current.closestEdge === closestEdge) {
							return current;
						}
						return {
							type: 'is-card-over',
							closestEdge,
						};
					});
				},
				onDragLeave: () => {
					setState(idleState);
				},
				onDrop: () => {
					setState(idleState);
				},
			}),
		);
	}, [instanceId, item, userId]);

	const performAction = (event: KeyboardEvent | MouseEvent) => {
		if (wasToggleInSelectionGroupKeyUsed(event)) {
			toggleSelectionInGroup(userId);
			return;
		}

		if (wasMultiSelectKeyUsed(event)) {
			multiSelectTo(userId);
			return;
		}

		toggleSelection(userId);
	};

	const handleCardClick = (event: MouseEvent) => {
		if (event.defaultPrevented) {
			return;
		}

		if (event.button !== primaryButton) {
			return;
		}

		// marking the event as used
		event.preventDefault();

		performAction(event);
	};

	const toggleMenu = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsMenuOpen(!isMenuOpen);
	};
	
	
	return (
		<div className="relative">
			<CardPrimitive
				ref={ref}
				item={item}
				state={state}
				isDragging={isDragging}
				isSelected={isSelected}
				onClick={handleCardClick}
			/>
			<button
				ref={actionMenuTriggerRef}
				onClick={toggleMenu}
				className="absolute top-2 right-2 p-1 rounded-full bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500"
			>
				<MoreVertical className="h-4 w-4" />
			</button>
			{isMenuOpen && (
				<div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
					<LazyDropdownItems userId={userId} onClose={() => setIsMenuOpen(false)} />
				</div>
			)}
			{state.type === 'preview' &&
				ReactDOM.createPortal(
					<div
						style={{
							/**
							 * Ensuring the preview has the same dimensions as the original.
							 *
							 * Using `border-box` sizing here is not necessary in this
							 * specific example, but it is safer to include generally.
							 */
							boxSizing: 'border-box',
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<CardPrimitive item={item} state={state} isSelected />
						{selectedCount > 0 && <div className="absolute right-[-0.25rem] top-[-0.25rem] text-white bg-gray-300 rounded-full h-8 w-8 leading-6 text-center font-semibold">{selectedCount}</div>}
					</div>,
					state.container,
				)}
		</div>
	);
});