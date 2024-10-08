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
	Fragment,
	ForwardedRef
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

import { DropdownMenu, DropdownTrigger, DropdownItem } from '../../../../components/DropdownMenu';
import { MoreVertical } from 'lucide-react';
import clsx from 'clsx';

type DraggableState =
	| { type: 'idle' }
	| { type: 'preview'; container: HTMLElement; rect: DOMRect }
	| { type: 'dragging' };

const idleState: DraggableState = { type: 'idle' };
const draggingState: DraggableState = { type: 'dragging' };


// https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
const primaryButton = 0;

type CardPrimitiveProps = {
	isSelected: boolean;
	closestEdge: Edge | null;
	item: Person;
	state: DraggableState;
	actionMenuTriggerRef?: ForwardedRef<HTMLButtonElement>;
	onClick?: MouseEventHandler;
};

const CardPrimitive = forwardRef<HTMLDivElement, CardPrimitiveProps>(function CardPrimitive(
	{ item, state, closestEdge, actionMenuTriggerRef, isSelected, onClick },
	ref,
) {
	const { avatarUrl, name, role, userId } = item;

	return (
		<div
			ref={ref}
			data-testid={`item-${userId}`}
			data-selected={isSelected}
			className={clsx(
				'relative grid grid-cols-[auto_1fr_auto] gap-3 items-center p-3 rounded-lg shadow-md transition-all duration-200',
				!isSelected && 'bg-white hover:bg-gray-50',
				isSelected && 'bg-indigo-100 hover:bg-indigo-200',
				state.type === 'dragging' && 'opacity-50 shadow-lg',
				state.type === 'preview' && 'opacity-100 bg-white shadow-xl',
			)}
			onClick={onClick}
			role="button"
			tabIndex={0}
		>

			<img src={avatarUrl} alt={`${name}'s avatar`} className="w-12 h-12 rounded-full pointer-events-none" />
			<div className="flex flex-col space-y-1">
				<span className="text-sm font-semibold">{name}</span>
				<span className="text-xs text-gray-500">{role}</span>
			</div>
			<ActionMenu actionMenuTriggerRef={actionMenuTriggerRef} cardId={userId} />

			{closestEdge && <DropIndicator edge={closestEdge} gap='8px' />}
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
	isSelected: boolean;
	selectedCount: number;
	multiSelectTo: (id: string) => void;
	toggleSelection: (id: string) => void;
	toggleSelectionInGroup: (id: string) => void;
};

export const Card = memo(function Card({
	item,
	isSelected,
	selectedCount,
	multiSelectTo,
	toggleSelection,
	toggleSelectionInGroup,
}: CardProps) {

	const ref = useRef<HTMLDivElement | null>(null);
	const { userId } = item;
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
	const [state, setState] = useState<DraggableState>(idleState);

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
		const element = ref.current;
		invariant(element);
		return combine(
			draggable({
				element: element,
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
				element: element,
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
					if (args.source.data.itemId !== userId) {
						setClosestEdge(extractClosestEdge(args.self.data));
					}
				},
				onDrag: (args) => {
					if (args.source.data.itemId !== userId) {
						setClosestEdge(extractClosestEdge(args.self.data));
					}
				},

				onDragLeave: () => {
					setClosestEdge(null);
				},
				onDrop: () => {
					setClosestEdge(null);
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

	
return (
	<Fragment>
		<CardPrimitive
			ref={ref}
			item={item}
			state={state}
			closestEdge={closestEdge}
			isSelected={isSelected}
			actionMenuTriggerRef={actionMenuTriggerRef}
			onClick={handleCardClick}
		/>
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

					<CardPrimitive item={item} state={state} closestEdge={null} isSelected={isSelected} />
					{selectedCount > 0 && (
						<div className="absolute right-[-0.25rem] top-[-0.25rem] text-white bg-gray-300 rounded-full h-8 w-8 flex items-center justify-center font-semibold">
							<span>{selectedCount}</span>
						</div>
					)}
				</div>,
				state.container,
			)}
	</Fragment>
);
});

function ActionMenu({ actionMenuTriggerRef, cardId }: { actionMenuTriggerRef?: ForwardedRef<HTMLButtonElement>, cardId: string }) {
	const { getColumns, reorderCard, moveCard } = useBoardContext();
	const { columnId, getCardIndex, getNumCards } = useColumnContext();
  
	const startIndex = getCardIndex(cardId);
	const numCards = getNumCards();
  
	const moveToTop = useCallback(() => {
	  reorderCard({ columnId, startIndex, finishIndex: 0, closestEdgeOfTarget: 'top' });
	}, [columnId, reorderCard, startIndex]);
  
	const moveUp = useCallback(() => {
	  reorderCard({ columnId, startIndex, finishIndex: startIndex - 1, closestEdgeOfTarget: 'top' });
	}, [columnId, reorderCard, startIndex]);
  
	const moveDown = useCallback(() => {
	  reorderCard({ columnId, startIndex, finishIndex: startIndex + 1, closestEdgeOfTarget: 'bottom' });
	}, [columnId, reorderCard, startIndex]);
  
	const moveToBottom = useCallback(() => {
	  reorderCard({ columnId, startIndex, finishIndex: numCards - 1, closestEdgeOfTarget: 'bottom' });
	}, [columnId, reorderCard, startIndex, numCards]);
  
	const isMoveUpDisabled = startIndex === 0;
	const isMoveDownDisabled = startIndex === numCards - 1;
  
	const moveColumnOptions = getColumns().filter((column) => column.columnId !== columnId);
  
	const MoveToOtherColumnItem = useCallback(({ targetColumn }: { targetColumn: ColumnType }) => {
	  const onClick = () => {
		moveCard({
		  startColumnId: columnId,
		  finishColumnId: targetColumn.columnId,
		  itemIndexInStartColumn: startIndex,
		});
	  };
  
	  return (
		<DropdownItem onClick={onClick}>
		  {targetColumn.title}
		</DropdownItem>
	  );
	}, [columnId, moveCard, startIndex]);
  
	return (
		<DropdownMenu id={`menu-${cardId}`}>
		  <DropdownTrigger ref={actionMenuTriggerRef}>
			<MoreVertical size={16} />
		  </DropdownTrigger>
		  <DropdownItem onClick={moveToTop} disabled={isMoveUpDisabled}>Move to top</DropdownItem>
		  <DropdownItem onClick={moveUp} disabled={isMoveUpDisabled}>Move up</DropdownItem>
		  <DropdownItem onClick={moveDown} disabled={isMoveDownDisabled}>Move down</DropdownItem>
		  <DropdownItem onClick={moveToBottom} disabled={isMoveDownDisabled}>Move to bottom</DropdownItem>
		  {moveColumnOptions.length > 0 && (
			<>
			  <div className="my-1 border-t border-gray-100"></div>
			  <div className="px-3 py-2 text-xs font-semibold text-gray-500">Move to</div>
			  {moveColumnOptions.map((column) => (
				<MoveToOtherColumnItem
				  key={column.columnId}
				  targetColumn={column}
				/>
			  ))}
			</>
		  )}
		</DropdownMenu>
	  );
	}