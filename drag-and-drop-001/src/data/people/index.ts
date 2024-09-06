/**
 * These imports are written out explicitly because they
 * need to be statically analyzable to be uploaded to CodeSandbox correctly.
 */
import Alexander from './images/processed/Alexander';
import Aliza from './images/processed/Alexander';
import Alvin from './images/processed/Alexander';
import Angie from './images/processed/Alexander';
import Arjun from './images/processed/Alexander';
import Blair from './images/processed/Alexander';
import Claudia from './images/processed/Alexander';
import Colin from './images/processed/Alexander';
import Ed from './images/processed/Alexander';
import Effie from './images/processed/Alexander';
import Eliot from './images/processed/Alexander';
import Fabian from './images/processed/Alexander';
import Gael from './images/processed/Alexander';
import Gerard from './images/processed/Alexander';
import Hasan from './images/processed/Alexander';
import Helena from './images/processed/Alexander';
import Ivan from './images/processed/Alexander';
import Katina from './images/processed/Alexander';
import Lara from './images/processed/Alexander';
import Leo from './images/processed/Alexander';
import Lydia from './images/processed/Alexander';;
import Maribel from './images/processed/Alexander';
import Milo from './images/processed/Alexander';
import Myra from './images/processed/Alexander';
import Narul from './images/processed/Alexander';
import Norah from './images/processed/Alexander';
import Oliver from './images/processed/Alexander';
import Rahul from './images/processed/Alexander';
import Renato from './images/processed/Alexander';
import Steve from './images/processed/Alexander';
import Tanya from './images/processed/Alexander';
import Tori from './images/processed/Alexander';
import Vania from './images/processed/Alexander';

export type Person = {
	userId: string;
	name: string;
	role: string;
	avatarUrl: string;
};

const avatarMap: Record<string, string> = {
	Alexander,
	Aliza,
	Alvin,
	Angie,
	Arjun,
	Blair,
	Claudia,
	Colin,
	Ed,
	Effie,
	Eliot,
	Fabian,
	Gael,
	Gerard,
	Hasan,
	Helena,
	Ivan,
	Katina,
	Lara,
	Leo,
	Lydia,
	Maribel,
	Milo,
	Myra,
	Narul,
	Norah,
	Oliver,
	Rahul,
	Renato,
	Steve,
	Tanya,
	Tori,
	Vania,
};

const names: string[] = Object.keys(avatarMap);

const roles: string[] = [
	'Engineer',
	'Senior Engineer',
	'Principal Engineer',
	'Engineering Manager',
	'Designer',
	'Senior Designer',
	'Lead Designer',
	'Design Manager',
	'Content Designer',
	'Product Manager',
	'Program Manager',
];

let sharedLookupIndex: number = 0;

/**
 * Note: this does not use randomness so that it is stable for VR tests
 */
export function getPerson(): Person {
	sharedLookupIndex++;
	return getPersonFromPosition({ position: sharedLookupIndex });
}

export function getPersonFromPosition({ position }: { position: number }): Person {
	// use the next name
	const name = names[position % names.length];
	// use the next role
	const role = roles[position % roles.length];
	return {
		userId: `id:${position}`,
		name,
		role,
		avatarUrl: avatarMap[name],
	};
}

export function getPeopleFromPosition({
	amount,
	startIndex,
}: {
	amount: number;
	startIndex: number;
}): Person[] {
	return Array.from({ length: amount }, () => getPersonFromPosition({ position: startIndex++ }));
}

export function getPeople({ amount }: { amount: number }): Person[] {
	return Array.from({ length: amount }, () => getPerson());
}

export type ColumnType = {
	title: string;
	columnId: string;
	items: Person[];
};
export type ColumnMap = { [columnId: string]: ColumnType };

export function getData({
	columnCount,
	itemsPerColumn,
}: {
	columnCount: number;
	itemsPerColumn: number;
}) {
	const columnMap: ColumnMap = {};

	for (let i = 0; i < columnCount; i++) {
		const column: ColumnType = {
			title: `Column ${i}`,
			columnId: `column-${i}`,
			items: getPeople({ amount: itemsPerColumn }),
		};
		columnMap[column.columnId] = column;
	}
	const orderedColumnIds = Object.keys(columnMap);

	return {
		columnMap,
		orderedColumnIds,
		lastOperation: null,
	};
}

export function getBasicData() {
	const columnMap: ColumnMap = {
		confluence: {
			title: 'Confluence',
			columnId: 'confluence',
			items: getPeople({ amount: 10 }),
		},
		jira: {
			title: 'Jira',
			columnId: 'jira',
			items: getPeople({ amount: 10 }),
		},
		trello: {
			title: 'Trello',
			columnId: 'trello',
			items: getPeople({ amount: 10 }),
		},
	};

	const orderedColumnIds = ['confluence', 'jira', 'trello'];

	return {
		columnMap,
		orderedColumnIds,
	};
}