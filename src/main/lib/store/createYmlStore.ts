import { SlugifyOptions } from '@shared/slug'
import { app } from 'electron'
import Store, { Options } from 'electron-store'
import { mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { parse as deserialize, stringify as serialize } from 'yaml'
const slugifyOptions = {
  lower: true,
  replacement: '_',
  trim: true,
  remove: /[*+~.()'"!:@]/g
} as SlugifyOptions
const getStoreUserData = () =>
  import.meta.env.PROD ? app.getPath('userData') : path.join('out/store')
if (!statSync(getStoreUserData(), { throwIfNoEntry: false }))
  mkdirSync(getStoreUserData(), { recursive: true })
export const createYmlStore = <T extends Record<string, any> = Record<string, any>>(
  name: string,
  options: Options<T> = {} as Options<T>
) =>
  new Store<T>({
    accessPropertiesByDotNotation: true,
    fileExtension: "yml",
    ...options,
    serialize,
    deserialize,
    name
  })
