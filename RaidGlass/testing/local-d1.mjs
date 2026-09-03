import { DatabaseSync } from "node:sqlite";

function statementResult(statement, values) {
    return {
        async first(columnName) {
            const row = statement.get(...values) ?? null;
            return columnName && row ? row[columnName] ?? null : row;
        },
        async all() {
            return { success: true, results: statement.all(...values) };
        },
        async run() {
            const result = statement.run(...values);
            return {
                success: true,
                meta: {
                    changes: Number(result.changes),
                    last_row_id: Number(result.lastInsertRowid),
                },
            };
        },
    };
}

export function openLocalD1(path = ":memory:") {
    const database = new DatabaseSync(path);
    return {
        exec(sql) {
            database.exec(sql);
        },
        prepare(sql) {
            const statement = database.prepare(sql);
            return {
                bind(...values) {
                    return statementResult(statement, values);
                },
                ...statementResult(statement, []),
            };
        },
        close() {
            database.close();
        },
    };
}
