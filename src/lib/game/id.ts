/** Branded string IDs used by museum/static game logic (no Convex runtime). */
export type Id<T extends string> = string & {
  readonly __tableName?: T
}
