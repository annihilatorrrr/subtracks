export type PromiseResolvedType<T> = T extends Promise<infer R> ? R : never
export type ReturnedPromiseResolvedType<T extends (...args: any) => any> = PromiseResolvedType<ReturnType<T>>

export type ToOpt<T> = {
  [K in keyof T]+?: T[K]
}
export type FunctionOpt<T extends Function, R> = T extends (...args: infer U) => unknown
  ? (...args: ToOpt<U>) => R
  : never
export type RecordOfFunctionsToOpt<T, R> = {
  [K in keyof T]: T[K] extends Function
    ? FunctionOpt<T[K], R>
    : T[K] extends {}
    ? RecordOfFunctionsToOpt<T[K], R>
    : T[K]
}
