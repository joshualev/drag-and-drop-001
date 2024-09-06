import React, { forwardRef, memo, type ReactNode, useEffect } from 'react';

import { autoScrollWindowForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';

import { useBoardContext } from '../board-context';

type BoardProps = {
	children: ReactNode;
};

const Board = forwardRef<HTMLDivElement, BoardProps>(({ children }: BoardProps, ref) => {
	const { instanceId } = useBoardContext();

	useEffect(() => {
		return autoScrollWindowForElements({
			canScroll: ({ source }) => source.data.instanceId === instanceId,
		});
	}, [instanceId]);

	return (
		<div className="flex flex-row justify-center gap-2 h-[480px]" ref={ref}>
			{children}
		</div>
	);
});

export default memo(Board);