import { createEncryptedStore } from "../store/createYmlStore";
type Credential = {
  account: string;
  password: string;
};
type Credentials = Array<Credential>;
type CredentialStore = {
  credentials: Record<string, any | null | undefined>;
};
const store = createEncryptedStore<CredentialStore>("credentials", {
  defaults: { credentials: {} },
});
class SecureStore {
  getAll() {
    return new Promise<Credentials>((resolve, reject) =>
      resolve(
        Object.entries(store.get("credentials", {})).map(
          ([account, password]) =>
            ({
              account,
              password,
            }) as Credential,
        ),
      ),
    );
  }
  set(key: string, value: string) {
    return new Promise<string | null>(async (resolve, reject) => {
      store.set(`credentials.${key}`, value);
      return resolve(value);
    });
  }
  get<T = any>(key: string) {
    return new Promise<T | null>(async (resolve, reject) => {
      const value = store.get(`credentials.${key}`, null);
      return resolve(value);
    });
  }
  delete(key: string) {
    return new Promise<boolean>(async (resolve, reject) => {
      store.delete(`credentials.${key}`);
      return resolve(true);
    });
  }
  readonly setPassword: typeof this.set = this.set.bind(this);
  readonly getPassword: typeof this.get = this.get.bind(this);
}

const secureStore = new SecureStore();
export default secureStore;
