import { isReactive, isRef, toRaw } from 'vue';

export function storeToRefs(store) {
    store = toRaw(store);

    const refs = {};

    for (const key in store) {
        const value = store[key]
        if(isRef(value) || isReactive) {
            refs[key] = toRef(store, key);
        }
    }

    return refs;
}