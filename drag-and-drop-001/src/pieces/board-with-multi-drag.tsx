import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';

import invariant from 'tiny-invariant';

import { triggerPostMoveFlash } from '@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';

import { type ColumnMap, type ColumnType, getBasicData, type Person } from '../data/people';
import Board from './Board/board';
import { BoardContext, type BoardContextValue } from './board-context';
import { Column } from './Board/Column/column';
import { createRegistry } from './Board/registry';

type Outcome =
	| {
			type: 'column-reorder';
			columnId: string;
			startIndex: number;
			finishIndex: number;
	  }
	| {
			type: 'card-reorder';
			columnId: string;
			startIndex: number;
			finishIndex: number;
	  }
	| {
			type: 'card-move';
			finishColumnId: string;
			itemIndexInStartColumn: number;
			itemIndexInFinishColumn: number;
	  }
      | {
            type: 'multi-card-drag';
            selectedUserIds: string[];
            draggedItemId: string;
            destinationColumnId: string;
            finalIndex: number;
        };

type BoardState = {
    columnMap: ColumnMap;
    orderedColumnIds: string[];
    lastOperation: Outcome | null;
    };

type SortUserIdsArgs = {
	draggedItemId: string;
	data: { columnMap: ColumnMap; orderedColumnIds: string[] };
	selectedUserIds: string[];
};

type MultiDragReorderArgs = {
	data: { columnMap: ColumnMap; orderedColumnIds: string[] };
	selectedUserIds: string[];
	draggedItemId: string;
	destinationColumnId: string;
	finalIndex: number;
};


// get the column that the user is in
const getHomeColumn = ({
	columnMap,
	orderedColumnIds,
	userId,
}: {
	columnMap: ColumnMap;
	orderedColumnIds: string[];
	userId: string;
}) => {
	const columnId = orderedColumnIds.find((id) =>
		columnMap[id].items.some((item) => item.userId === userId),
	);
	invariant(columnId, 'Count not find column for user');
	return columnMap[columnId];
};

// select all the users in the column up to the index of the current user
const multiSelect = ({
	columnMap,
	orderedColumnIds,
	selectedUserIds,
	userId,
}: {
	columnMap: ColumnMap;
	orderedColumnIds: string[];
	selectedUserIds: string[];
	userId: string;
}) => {
	const columnOfNew = getHomeColumn({
		columnMap,
		orderedColumnIds,
		userId,
	});
	const indexOfNew = columnOfNew.items.findIndex((item) => item.userId === userId);

	// if no items selected, select everything in the column up to the index of the current item
	if (!selectedUserIds.length) {
		return columnOfNew.items.slice(0, indexOfNew + 1).map((item) => item.userId);
	}

	const lastSelected = selectedUserIds[selectedUserIds.length - 1];
	const columnOfLast = getHomeColumn({
		columnMap,
		orderedColumnIds,
		userId: lastSelected,
	});
	const indexOfLast = columnOfLast.items.findIndex((item) => item.userId === lastSelected);

	// multi selecting to another column
	// select everything up to the index of the current item
	if (columnOfNew !== columnOfLast) {
		return columnOfNew.items.slice(0, indexOfNew + 1).map((item) => item.userId);
	}

	// multi selecting in the same column
	// need to select everything between the last index and the current index inclusive

	// nothing to do here
	if (indexOfNew === indexOfLast) {
		return;
	}

	const isSelectingForwards = indexOfNew > indexOfLast;
	const start = isSelectingForwards ? indexOfLast : indexOfNew;
	const end = isSelectingForwards ? indexOfNew : indexOfLast;
	const inBetween = columnOfNew.items.slice(start, end + 1).map((item) => item.userId);

	// everything inbetween needs to have it's selection toggled.
	// with the exception of the start and end values which will always be selected
	const toAdd = inBetween.filter((userId) => !selectedUserIds.includes(userId));
	const sorted = isSelectingForwards ? toAdd : [...toAdd].reverse();

	return [...selectedUserIds, ...sorted];
};

// create a new column with the items in the correct order
const withNewItems = (column: ColumnType, items: Person[]): ColumnType => ({
	columnId: column.columnId,
	title: column.title,
	items,
});

// sort the selectedUserIds by their index in their own column
const sortUserIds = ({ draggedItemId, data, selectedUserIds }: SortUserIdsArgs): string[] => {
	return [...selectedUserIds].sort((a: string, b: string) => {
		// moving the dragged item to the top of the list
		if (a === draggedItemId) {
			return -1;
		}
		if (b === draggedItemId) {
			return 1;
		}

		const columnA = data.orderedColumnIds.find((columnId) =>
			data.columnMap[columnId].items.some((i) => i.userId === a),
		);
		const columnB = data.orderedColumnIds.find((columnId) =>
			data.columnMap[columnId].items.some((i) => i.userId === b),
		);
		const aIndex = data.columnMap[columnA!].items.findIndex((i) => i.userId === a);
		const bIndex = data.columnMap[columnB!].items.findIndex((i) => i.userId === b);
		if (aIndex !== bIndex) {
			return aIndex - bIndex;
		}

		// sorting by their order in the selectedUserIds list
		return -1;
	});
};


export default function BoardExample() {

    const [data, setData] = useState<BoardState>(() => {
		const base = getBasicData();
		return {
			...base,
			lastOperation: null,
		};
	});

	const stableData = useRef(data);
	useEffect(() => {
		stableData.current = data;
	}, [data]);

	const [registry] = useState(createRegistry);

    const { lastOperation } = data;

    useEffect(() => {
		if (lastOperation === null) {
			return;
		}

        // column reorder
		if (lastOperation.type === 'column-reorder') {
			const { finishIndex } = lastOperation;

			const { columnMap, orderedColumnIds } = stableData.current;
			const sourceColumn = columnMap[orderedColumnIds[finishIndex]];

			const entry = registry.getColumn(sourceColumn.columnId);
			triggerPostMoveFlash(entry.element);

			return;
		}
        // card reorder
        if (lastOperation.type === 'card-reorder') {
			const { columnId, finishIndex } = lastOperation;

			const { columnMap } = stableData.current;
			const column = columnMap[columnId];
			const item = column.items[finishIndex];

			const entry = registry.getCard(item.userId);
			triggerPostMoveFlash(entry.element);

			return;
		}

        // card move
        if (lastOperation.type === 'card-move') {
			const { finishColumnId, itemIndexInFinishColumn } = lastOperation;

			const data = stableData.current;
			const destinationColumn = data.columnMap[finishColumnId];
			const item = destinationColumn.items[itemIndexInFinishColumn];

			const entry = registry.getCard(item.userId);
			triggerPostMoveFlash(entry.element);


			/**
			 * Because the card has moved column, it will have remounted.
			 * This means we need to manually restore focus to it.
			 */
			entry.actionMenuTrigger.focus();

			return;
		}

		// multi card drag
		// 1. Apply post-move flash to all moved cards
		// 2. Unset selected card IDs
		if (lastOperation.type === 'multi-card-drag') {
			const { destinationColumnId, finalIndex, selectedUserIds } = lastOperation;
		
			const data = stableData.current;
			const destinationColumn = data.columnMap[destinationColumnId];
		
			// Apply post-move flash to all moved cards
			selectedUserIds.forEach((userId, index) => {
				const item = destinationColumn.items[finalIndex + index];
				if (item && item.userId === userId) {
					const entry = registry.getCard(userId);
					triggerPostMoveFlash(entry.element);
				}
			});
		
			// Unset selected card IDs
			setSelectedUserIds([]);
		
			return;
		}
    }, [lastOperation, registry]);

    const getColumns = useCallback(() => {
		const { columnMap, orderedColumnIds } = stableData.current;
		return orderedColumnIds.map((columnId) => columnMap[columnId]);
	}, []);

    const reorderColumn = useCallback(
        ({
            startIndex,
            finishIndex,
            closestEdgeOfTarget,
        }: {
            startIndex: number;
            finishIndex: number;
            closestEdgeOfTarget: Edge | null;
        }) => {
            setData((data) => {
                const outcome: Outcome = {
                    type: 'column-reorder',
                    columnId: data.orderedColumnIds[startIndex],
                    startIndex,
                    finishIndex,
                };

                return {
                    ...data,
                    orderedColumnIds: reorderWithEdge({
                        list: data.orderedColumnIds,
                        startIndex,
                        indexOfTarget: finishIndex,
                        closestEdgeOfTarget,
                        axis: 'horizontal',
                    }),
                    lastOperation: outcome,
                };
            });
        },
        [],
    );

    const reorderCard = useCallback(
        ({
            columnId,
            startIndex,
            finishIndex,
            closestEdgeOfTarget,
        }: {
            columnId: string;
            startIndex: number;
            finishIndex: number;
            closestEdgeOfTarget: Edge | null;
        }) => {
            setData((data) => {
                const sourceColumn = data.columnMap[columnId];
                const updatedItems = reorderWithEdge({
                    list: sourceColumn.items,
                    startIndex,
                    indexOfTarget: finishIndex,
                    closestEdgeOfTarget,
                    axis: 'vertical',
                });

                const updatedSourceColumn: ColumnType = {
                    ...sourceColumn,
                    items: updatedItems,
                };

                const updatedMap: ColumnMap = {
                    ...data.columnMap,
                    [columnId]: updatedSourceColumn,
                };

                const outcome: Outcome = {
                    type: 'card-reorder',
                    columnId,
                    startIndex,
                    finishIndex,
                };

                return {
                    ...data,
                    columnMap: updatedMap,
                    lastOperation: outcome,
                };
            });
        },
        [],
    );

    const moveCard = useCallback(
		({
			startColumnId,
			finishColumnId,
			itemIndexInStartColumn,
			itemIndexInFinishColumn,
		}: {
			startColumnId: string;
			finishColumnId: string;
			itemIndexInStartColumn: number;
			itemIndexInFinishColumn?: number;
		}) => {
			// invalid cross column movement
			if (startColumnId === finishColumnId) {
				return;
			}
			setData((data) => {
				const sourceColumn = data.columnMap[startColumnId];
				const destinationColumn = data.columnMap[finishColumnId];
				const item: Person = sourceColumn.items[itemIndexInStartColumn];

				const destinationItems = Array.from(destinationColumn.items);
				// Going into the first position if no index is provided
				const newIndexInDestination = itemIndexInFinishColumn ?? 0;
				destinationItems.splice(newIndexInDestination, 0, item);

				const updatedMap = {
					...data.columnMap,
					[startColumnId]: {
						...sourceColumn,
						items: sourceColumn.items.filter((i) => i.userId !== item.userId),
					},
					[finishColumnId]: {
						...destinationColumn,
						items: destinationItems,
					},
				};

				const outcome: Outcome = {
					type: 'card-move',
					finishColumnId,
					itemIndexInStartColumn,
					itemIndexInFinishColumn: newIndexInDestination,
				};

				return {
					...data,
					columnMap: updatedMap,
					lastOperation: outcome,
				};
			});
		},
		[],
	);


// multi drag reorder function
// 1. Remove all selected items from their original column
// 2. Calculate the new order of items (sort selectedUserIds by their index in their present column)
// 3. Insert them back in at the correct index
const multiDragReorder = useCallback((args: MultiDragReorderArgs) => {
	const { data, selectedUserIds, draggedItemId, destinationColumnId, finalIndex } = args;
	// 1. Remove all selected items from their columns
	const withRemovedItems = data.orderedColumnIds.reduce((acc, columnId) => {
		const column = data.columnMap[columnId];
		const items = column.items.filter((item) => !selectedUserIds.includes(item.userId));
		return {
			...acc,
			[columnId]: withNewItems(column, items),
		};
	}, {} as ColumnMap);

	// 2. Calculate the new order of items (sort selectedUserIds by their index in their own column)
	const orderedSelectedUserIds = sortUserIds({
		data,
		draggedItemId,
		selectedUserIds,
	});

	const orderedSelectedItems = orderedSelectedUserIds.map(
		(id) =>
			getHomeColumn({
				columnMap: data.columnMap,
				orderedColumnIds: data.orderedColumnIds,
				userId: id,
			}).items.find((i) => i.userId === id)!,
	);

	// 3. Insert them back in at the correct index
	const final: ColumnType = withRemovedItems[destinationColumnId];
	const withInserted = (() => {
		const base = [...final.items];
		base.splice(finalIndex, 0, ...orderedSelectedItems);
		return base;
	})();

	const withAddedTasks = {
		...withRemovedItems,
		[destinationColumnId]: withNewItems(final, withInserted),
	};

	// Create the lastOperation outcome
	const outcome: Outcome = {
		type: 'multi-card-drag',
		selectedUserIds: orderedSelectedUserIds,
		draggedItemId,
		destinationColumnId,
		finalIndex,
	};

	return {
		reorderedColumnMap: withAddedTasks,
		orderedSelectedUserIds,
		lastOperation: outcome,
	};
}, []);


    const [instanceId] = useState(() => Symbol('instance-id'));
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [isDraggingCard, setIsDraggingCard] = useState(false);
    
    useEffect(() => {
		return combine(
			monitorForElements({
				canMonitor({ source }) {
					return source.data.instanceId === instanceId;
				},
                onGenerateDragPreview({ source }) {
                    if (source.data.type === 'card') {
                        const itemId = source.data.itemId;
                        invariant(typeof itemId === 'string');
                        if (!selectedUserIds.includes(itemId)) {
                            setSelectedUserIds([]);
                        }
                    }
                },
                onDragStart({ source }) {
                    if (source.data.type === 'card') {
                        setIsDraggingCard(true);
                    }
                },
				onDrop(args) {
                    const { location, source } = args;

                    if (source.data.type === 'card') {
                        setIsDraggingCard(false);
                    }
    
					// didn't drop on anything
					if (!location.current.dropTargets.length) {
						return;
					}
					// need to handle drop

					// 1. remove element from original position
					// 2. move to new position

					if (source.data.type === 'column') {
						const startIndex: number = data.orderedColumnIds.findIndex(
							(columnId) => columnId === source.data.columnId,
						);

						const target = location.current.dropTargets[0];
						const indexOfTarget: number = data.orderedColumnIds.findIndex(
							(id) => id === target.data.columnId,
						);
						const closestEdgeOfTarget: Edge | null = extractClosestEdge(target.data);

						reorderColumn({ startIndex, finishIndex: indexOfTarget, closestEdgeOfTarget });
					}

                    
					// Dragging a card
					if (source.data.type === 'card') {
						const itemId = source.data.itemId;
						invariant(typeof itemId === 'string');
						// TODO: these lines not needed if item has columnId on it
						const [, startColumnRecord] = location.initial.dropTargets;
						const sourceId = startColumnRecord.data.columnId;
						invariant(typeof sourceId === 'string');
						const sourceColumn = data.columnMap[sourceId];
						const itemIndex = sourceColumn.items.findIndex((item) => item.userId === itemId);

				
                        // Multi drag
                        if (selectedUserIds.length > 1) {
                            // Dropping in a column (relative to a card)
                            if (location.current.dropTargets.length === 2) {
                                // 1. Get target index
                                const [destinationCardRecord, destinationColumnRecord] = location.current.dropTargets;
                                const destinationColumnId = destinationColumnRecord.data.columnId;
                                invariant(typeof destinationColumnId === 'string');
                                const destinationColumn = data.columnMap[destinationColumnId];

                                const indexOfTarget = destinationColumn.items.findIndex(
                                    (item) => item.userId === destinationCardRecord.data.itemId,
                                );

                                const closestEdgeOfTarget: Edge | null = extractClosestEdge(
                                    destinationCardRecord.data,
                                );

                                const indexOfTargetWithEdge = (() => {
                                    if (sourceId === destinationColumnId) {
                                        return reorderWithEdge({
                                            list: destinationColumn.items,
                                            startIndex: itemIndex,
                                            indexOfTarget,
                                            closestEdgeOfTarget,
                                            axis: 'vertical',
                                        }).findIndex((item) => item.userId === itemId);
                                    }
                                    return closestEdgeOfTarget === 'bottom' ? indexOfTarget + 1 : indexOfTarget;
                                })();

                                const selectedItemsBeforeTarget = selectedUserIds.filter((id) => {
                                    const itemIndex = destinationColumn.items.findIndex((i) => i.userId === id);
                                    if (itemIndex === -1) {
                                        return false;
                                    }
                                    return itemIndex < indexOfTargetWithEdge;
                                });

                                const finalIndex = selectedItemsBeforeTarget.length
                                    ? indexOfTargetWithEdge - (selectedItemsBeforeTarget.length - 1)
                                    : indexOfTargetWithEdge;

                                // 2. Perform reorder
                                const { reorderedColumnMap, orderedSelectedUserIds, lastOperation } = multiDragReorder({
                                    data,
                                    selectedUserIds,
                                    draggedItemId: itemId,
                                    destinationColumnId,
                                    finalIndex,
                                });

                                setData({
                                    ...data,
                                    columnMap: reorderedColumnMap,
                                    lastOperation: lastOperation,
                                });
                                setSelectedUserIds(orderedSelectedUserIds);
                                return;
                            }

                            // Dropping on a column (inserting into last position)
                            if (location.current.dropTargets.length === 1) {
                                // 1. Get target index
                                const [destinationColumnRecord] = location.current.dropTargets;
                                const destinationColumnId = destinationColumnRecord.data.columnId;
                                invariant(typeof destinationColumnId === 'string');
                                const destinationColumn = data.columnMap[destinationColumnId];
                                invariant(destinationColumn);
                                const finalIndex = destinationColumn.items.length;

                                // 2: Perform reorder
                                const { reorderedColumnMap, orderedSelectedUserIds, lastOperation } = multiDragReorder({
                                    data,
                                    selectedUserIds,
                                    draggedItemId: itemId,
                                    destinationColumnId,
                                    finalIndex,
                                });

                                setData({
                                    ...data,
                                    columnMap: reorderedColumnMap,
                                    lastOperation: lastOperation,
                                });
                                setSelectedUserIds(orderedSelectedUserIds);
                                return;
                            }
                        }

                        // Single drag: dropping on a column (inserting into last position)
                        if (location.current.dropTargets.length === 1) {
							const [destinationColumnRecord] = location.current.dropTargets;
							const destinationId = destinationColumnRecord.data.columnId;
							invariant(typeof destinationId === 'string');
							const destinationColumn = data.columnMap[destinationId];
							invariant(destinationColumn);

							// reordering in same column
							if (sourceColumn === destinationColumn) {
								reorderCard({
									columnId: sourceColumn.columnId,
									startIndex: itemIndex,
									finishIndex: sourceColumn.items.length - 1,
									closestEdgeOfTarget: null,
								});
								return;
							}

							// moving to a new column
							moveCard({
								itemIndexInStartColumn: itemIndex,
								startColumnId: sourceColumn.columnId,
								finishColumnId: destinationColumn.columnId,
							});
							return;
						}

						// dropping in a column (relative to a card)
						if (location.current.dropTargets.length === 2) {
							const [destinationCardRecord, destinationColumnRecord] = location.current.dropTargets;
							const destinationColumnId = destinationColumnRecord.data.columnId;
							invariant(typeof destinationColumnId === 'string');
							const destinationColumn = data.columnMap[destinationColumnId];

							const indexOfTarget = destinationColumn.items.findIndex(
								(item) => item.userId === destinationCardRecord.data.itemId,
							);
							const closestEdgeOfTarget: Edge | null = extractClosestEdge(
								destinationCardRecord.data,
							);

							// case 1: ordering in the same column
							if (sourceColumn === destinationColumn) {
								reorderCard({
									columnId: sourceColumn.columnId,
									startIndex: itemIndex,
									finishIndex: indexOfTarget,
									closestEdgeOfTarget,
								});
								return;
							}

							// case 2: moving into a new column relative to a card

							const destinationIndex =
								closestEdgeOfTarget === 'bottom' ? indexOfTarget + 1 : indexOfTarget;

							moveCard({
								itemIndexInStartColumn: itemIndex,
								startColumnId: sourceColumn.columnId,
								finishColumnId: destinationColumn.columnId,
								itemIndexInFinishColumn: destinationIndex,
							});
						}
					}
				},
			}),
		);
	}, [data, instanceId, moveCard, reorderCard, reorderColumn, selectedUserIds, multiDragReorder]);


	const toggleSelection = (userId: string) => {
		const updatedUserIds = (() => {
			// Task was not previously selected
			// now will be the only selected item
			if (!selectedUserIds.includes(userId)) {
				return [userId];
			}

			// Task was part of a selected group
			// will now become the only selected item
			if (selectedUserIds.length > 1) {
				return [userId];
			}

			// task was previously selected but not in a group
			// we will now clear the selection
			return [];
		})();

		setSelectedUserIds(updatedUserIds);
	};

	const toggleSelectionInGroup = (userId: string) => {
		const index = selectedUserIds.indexOf(userId);

		// if not selected - add it to the selected items
		if (index === -1) {
			setSelectedUserIds([...selectedUserIds, userId]);
			return;
		}

		// it was previously selected and now needs to be removed from the group
		const newIds = [...selectedUserIds];
		newIds.splice(index, 1);
		setSelectedUserIds(newIds);
	};

	// This behaviour matches the MacOSX finder selection
	const multiSelectTo = (userId: string) => {
		const updated = multiSelect({
			columnMap: data.columnMap,
			orderedColumnIds: data.orderedColumnIds,
			selectedUserIds,
			userId,
		});

		if (!updated) {
			return;
		}

		setSelectedUserIds(updated);
	};


    const contextValue: BoardContextValue = useMemo(() => {
		return {
			getColumns,
			reorderColumn,
			reorderCard,
			moveCard,
			multiDragReorder,
			registerCard: registry.registerCard,
			registerColumn: registry.registerColumn,
			instanceId,
		};
	}, [getColumns, reorderColumn, reorderCard, registry, moveCard, instanceId, multiDragReorder]);

	return (
        <BoardContext.Provider value={contextValue}>
            <Board>
                {data.orderedColumnIds.map((columnId) => {
                    return (
                        <Column
                            column={data.columnMap[columnId]}
                            key={columnId}
                            isDraggingCard={isDraggingCard}
                            selectedUserIds={selectedUserIds}
                            multiSelectTo={multiSelectTo}
                            toggleSelection={toggleSelection}
                            toggleSelectionInGroup={toggleSelectionInGroup}
                        />
                    );
                })}
            </Board>
        </BoardContext.Provider>
	);
}