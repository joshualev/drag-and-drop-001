import React, { memo, useEffect, useRef, useState,useCallback,useMemo } from 'react';
import { createPortal } from 'react-dom';
import invariant from 'tiny-invariant';
import classNames from 'classnames';
import { MoreVertical } from 'lucide-react';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { DropIndicator } from '../../../components/drop-indicator';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { centerUnderPointer } from '@atlaskit/pragmatic-drag-and-drop/element/center-under-pointer';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';

import { useBoardContext } from '../../board-context';
import { type ColumnType } from '../../../data/people';
import { ColumnContext, type ColumnContextProps, useColumnContext } from './column-context';
import { Card } from './Card/card';

type State =
  | { type: 'idle' }
  | { type: 'is-card-over' }
  | { type: 'generate-safari-column-preview'; container: HTMLElement }
  | { type: 'generate-column-preview' }
  | { type: 'is-column-over'; closestEdge: Edge | null };

// preventing re-renders
const idle: State = { type: 'idle' };
const isCardOver: State = { type: 'is-card-over' };

type ColumnProps = {
  column: ColumnType;
  isDraggingCard: boolean;
  selectedUserIds: string[];
  multiSelectTo: (userId: string) => void;
  toggleSelection: (userId: string) => void;
  toggleSelectionInGroup: (userId: string) => void;
};

export const Column = memo(function Column({
  column,
  selectedUserIds,
  isDraggingCard,
  multiSelectTo,
  toggleSelection,
  toggleSelectionInGroup,
}: ColumnProps) {
  const columnId = column.columnId;
  const columnRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const cardListRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<State>(idle);

  const { instanceId, registerColumn } = useBoardContext();

  useEffect(() => {
    invariant(columnRef.current);
    invariant(headerRef.current);
    invariant(cardListRef.current);
    invariant(scrollContainerRef.current);
    return combine(
      registerColumn({
				columnId,
				entry: {
					element: columnRef.current,
				},
			}),
      draggable({
        element: columnRef.current,
        dragHandle: headerRef.current,
   	    getInitialData: () => ({ columnId, type: 'column', instanceId }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          const isSafari: boolean =
            navigator.userAgent.includes('AppleWebKit') && !navigator.userAgent.includes('Chrome');

          if (!isSafari) {
            setState({ type: 'generate-column-preview' });
            return;
          }
          setCustomNativeDragPreview({
            getOffset: centerUnderPointer,
            render: ({ container }) => {
              setState({ type: 'generate-safari-column-preview', container });
              return () => setState(idle);
            },
            nativeSetDragImage,
          });
        },
        onDragStart: () => {
          setState(idle);
        },
      }),
      dropTargetForElements({
				element: cardListRef.current,
				getData: () => ({ columnId }),
				canDrop: ({ source }) => {
					return source.data.instanceId === instanceId && source.data.type === 'card';
				},
				getIsSticky: () => true,
				onDragEnter: () => setState(isCardOver),
				onDragLeave: () => setState(idle),
				onDragStart: () => setState(isCardOver),
				onDrop: () => setState(idle),
			}),

      dropTargetForElements({
        element: columnRef.current,
      	canDrop: ({ source }) => {
					return source.data.instanceId === instanceId && source.data.type === 'column';
				},
        getIsSticky: () => true,
        getData: ({ input, element }) => {
          const data = { columnId };
          return attachClosestEdge(data, {
            input,
            element,
            allowedEdges: ['left', 'right'],
          });
        },
        onDragEnter: (args) => {
          setState({
            type: 'is-column-over',
            closestEdge: extractClosestEdge(args.self.data),
          });
        },
        onDrag: (args) => {
          setState((current) => {
            const closestEdge: Edge | null = extractClosestEdge(args.self.data);
            if (current.type === 'is-column-over' && current.closestEdge === closestEdge) {
              return current;
            }
            return {
              type: 'is-column-over',
              closestEdge,
            };
          });
        },
        onDragLeave: () => {
          setState(idle);
        },
        onDrop: () => {
          setState(idle);
        },
      }),
      autoScrollForElements({
				element: scrollContainerRef.current,
				canScroll: ({ source }) =>
					source.data.instanceId === instanceId && source.data.type === 'card',
			}),
    );
  }, [columnId, registerColumn, instanceId]);

  const stableItems = useRef(column.items);
	useEffect(() => {
		stableItems.current = column.items;
	}, [column.items]);

  const getCardIndex = useCallback((userId: string) => {
		return stableItems.current.findIndex((item) => item.userId === userId);
	}, []);

	const getNumCards = useCallback(() => {
		return stableItems.current.length;
	}, []);

	const contextValue: ColumnContextProps = useMemo(() => {
		return { columnId, getCardIndex, getNumCards };
	}, [columnId, getCardIndex, getNumCards]);


  const columnClasses = classNames(
    'w-[250px] shadow rounded-lg relative p-2 ease-in-out duration-300',
    {
      'bg-blue-200': state.type === 'is-card-over',
      'bg-gray-50': state.type === 'idle',
      'isolate': state.type === 'generate-column-preview',
    }
  );


  return (
    <ColumnContext.Provider value={contextValue}>
      <div className={`${columnClasses} flex flex-col h-[480px]`} ref={columnRef}>
        <div className="p-2 flex justify-between text-gray-600 select-none" ref={headerRef} data-testid={`column-${columnId}--header`}>
          <h3 className="text-sm font-medium">{column.title}</h3>
          <ActionMenu />
        </div>
        <div className="flex-grow overflow-y-auto" ref={scrollContainerRef}>
          <div className="box-border min-h-full gap-2 flex flex-col p-2" ref={cardListRef}>
            {column.items.map((item) => (
              <Card
                item={item}
                key={item.userId}
                isDragging={isDraggingCard}
                isSelected={selectedUserIds.some((id) => id === item.userId)}
                selectedCount={selectedUserIds.length}
                multiSelectTo={multiSelectTo}
                toggleSelection={toggleSelection}
                toggleSelectionInGroup={toggleSelectionInGroup}
              />
            ))}
          </div>
        </div>
        {state.type === 'is-column-over' && state.closestEdge && (
          <DropIndicator edge={state.closestEdge} gap='8px' />
        )}
      </div>
      {state.type === 'generate-safari-column-preview'
        ? createPortal(<SafariColumnPreview column={column} />, state.container)
        : null}
    </ColumnContext.Provider>
  );
});

function SafariColumnPreview({ column }: { column: ColumnType }) {
  return (
    <div className="w-[250px] bg-gray-100 rounded-lg p-2 text-gray-600 select-none">
      <h3 className="text-sm font-medium">{column.title}</h3>
    </div>
  );
}

function ActionMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <div className="relative inline-block text-left">
      <DropdownMenuTrigger onClick={toggleMenu} />
      {isOpen && <ActionMenuItems onClose={() => setIsOpen(false)} />}
    </div>
  );
}

function ActionMenuItems({ onClose }: { onClose: () => void }) {
  const { columnId } = useColumnContext();
  const { getColumns, reorderColumn } = useBoardContext();

  const columns = getColumns();
  const startIndex = columns.findIndex((column) => column.columnId === columnId);

  const moveLeft = useCallback(() => {
    reorderColumn({
      startIndex,
      finishIndex: startIndex - 1,
      closestEdgeOfTarget: 'left',
    });
    onClose();
  }, [reorderColumn, startIndex, onClose]);

  const moveRight = useCallback(() => {
    reorderColumn({
      startIndex,
      finishIndex: startIndex + 1,
      closestEdgeOfTarget: 'right',
    });
    onClose();
  }, [reorderColumn, startIndex, onClose]);

  const isMoveLeftDisabled = startIndex === 0;
  const isMoveRightDisabled = startIndex === columns.length - 1;

  return (
    <div className="absolute z-10 right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
        <button
          onClick={moveLeft}
          disabled={isMoveLeftDisabled}
          className={`block w-full text-left px-4 py-2 text-sm ${
            isMoveLeftDisabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }`}
          role="menuitem"
        >
          Move left
        </button>
        <button
          onClick={moveRight}
          disabled={isMoveRightDisabled}
          className={`block w-full text-left px-4 py-2 text-sm ${
            isMoveRightDisabled ? 'text-gray-400' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          }`}
          role="menuitem"
        >
          Move right
        </button>
      </div>
    </div>
  );
}

function DropdownMenuTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex justify-center items-center w-8 h-8 rounded-full bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-indigo-500"
      id="options-menu"
      aria-haspopup="true"
      aria-expanded="true"
    >
      <MoreVertical className="h-5 w-5" />
    </button>
  );
}