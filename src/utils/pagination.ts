export function getPagination(cursor?: number, limit = 10) {
    return {
        take: limit + 1,
        ...(cursor && {
            cursor: { id: cursor },
            skip: 1
        }),
    };
}