import { createSettingsSlice, SettingsSlice } from '@app/state/settings'
import equal from 'fast-deep-equal'
import create, { GetState, Mutate, SetState, State, StateCreator, StateSelector, StoreApi } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import migrations from './migrations'
import { createTrackPlayerSlice, TrackPlayerSlice } from './trackplayer'
import produce, { Draft } from 'immer'
import { WritableDraft } from 'immer/dist/internal'
import { createDownloadSlice, DownloadSlice } from './download'
import { zustandStorage } from './storage'

const DB_VERSION = migrations.length

export type Store = SettingsSlice & TrackPlayerSlice & DownloadSlice

// taken from zustand test examples:
// https://github.com/pmndrs/zustand/blob/v3.7.1/tests/middlewareTypes.test.tsx#L20
const immer =
  <
    T extends State,
    CustomSetState extends SetState<T>,
    CustomGetState extends GetState<T>,
    CustomStoreApi extends StoreApi<T>,
  >(
    config: StateCreator<
      T,
      (partial: ((draft: Draft<T>) => void) | T, replace?: boolean) => void,
      CustomGetState,
      CustomStoreApi
    >,
  ): StateCreator<T, CustomSetState, CustomGetState, CustomStoreApi> =>
  (set, get, api) =>
    config(
      (partial, replace) => {
        const nextState = typeof partial === 'function' ? produce(partial as (state: Draft<T>) => T) : (partial as T)
        return set(nextState, replace)
      },
      get,
      api,
    )

export type SetStore = (partial: Store | ((draft: WritableDraft<Store>) => void), replace?: boolean | undefined) => void
export type GetStore = GetState<Store>

// types taken from zustand test examples:
// https://github.com/pmndrs/zustand/blob/v3.7.1/tests/middlewareTypes.test.tsx#L584
export const useStore = create<
  Store,
  SetState<Store>,
  GetState<Store>,
  Mutate<StoreApi<Store>, [['zustand/subscribeWithSelector', never], ['zustand/persist', Partial<Store>]]>
>(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...createSettingsSlice(set, get),
        ...createTrackPlayerSlice(set, get),
        ...createDownloadSlice(set, get),
      })),
      {
        name: '@appStore',
        version: DB_VERSION,
        getStorage: () => zustandStorage,
        partialize: state => ({ settings: state.settings }),
        migrate: async (persistedState, version) => {
          if (version > DB_VERSION) {
            throw new Error('cannot migrate db on a downgrade, delete all data first')
          }

          for (let i = version; i < DB_VERSION; i++) {
            persistedState = await migrations[i](persistedState)
          }

          return persistedState
        },
      },
    ),
  ),
)

export const useStoreDeep = <U>(stateSelector: StateSelector<Store, U>) => useStore(stateSelector, equal)
