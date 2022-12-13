import { isObject } from '@vue/shared';
import {
    computed,
    effectScope,
    getCurrentInstance,
    inject,
    isRef,
    reactive,
    toRefs,
    watch,
} from 'vue';
import { addSubscription, triggerSubscription } from './pubSub';
import { SymbolPinia } from './rootStore';

export function defineStore(idOrOptions, setup) {
    // 处理参数
    let id;
    let options;
    if (typeof idOrOptions === 'string') {
        id = idOrOptions;
        options = setup;
    } else {
        id = idOrOptions.id;
        options = idOrOptions;
    }

    const isSetupStore = typeof setup === 'function';

    // 创建store
    function useStore() {
        const currentInstance = getCurrentInstance();
        // 这里表示useStore只能在setup中调用
        // 注入创建的pinia
        const pinia = currentInstance && inject(SymbolPinia);

        // 避免重复创建
        if (!pinia._s.has(id)) {
            if (isSetupStore) {
                createSetupStore(id, setup, pinia);
            } else {
                createOptionsStore(id, options, pinia);
            }
        }

        const store = pinia._s.get(id);
        return store;
    }

    return useStore;
}


// 处理函数形式
function createSetupStore(id, setup, pinia) {
    let scope;

    // _e能够停止所有的store，为了能够单独停止某一个store，因此对每个store都需要再创建一个scope
    // 执行setup函数，获取返回值【Object】
    const setupStore = pinia._e.run(() => {
        scope = effectScope();
        // 直接执行setup函数
        return scope.run(() => setup());
    });
    // 将当前状态与id进行绑定
    pinia.state.value[id] = setupStore;

    // 包转器
    function wrapAction(name, action) {
        return function () {

            // 并且对函数包裹之后，可以在触发函数时，做一些额外的处理

            const afterCallbackList = [];
            const onErrorCallbackList = [];
            function after(callback) {
                afterCallbackList.push(callback);
            }
            function onError(callback) {
                onErrorCallbackList.push(callback);
            }

            // 在执行真正的函数的时候对after和onError的callback收集
            triggerSubscription(actionSubscribes, {
                after,
                onError,
                store,
                name,
            });

            let ret;

            try {
                // 由于actions中可以使用this，因此需要进行this绑定
                ret = action.apply(store, arguments);
            } catch (error) {
                // 如果抛出错误则直接直接执行onError的callback函数
                triggerSubscription(onErrorCallbackList, error);
            }

            // 如果是Promise 则等待Promise的返回结果
            if (ret instanceof Promise) {
                return ret
                    .then((value) => {
                        triggerSubscription(afterCallbackList, value);
                    })
                    .catch((err) => {
                        triggerSubscription(onErrorCallbackList, err);
                        return Promise.reject(err);
                    });
            } else {
                // 执行成功直接调用after函数的callback函数
                triggerSubscription(afterCallbackList, ret);
            }

            return ret;
        };
    }

    // 对返回值【Object】中属于函数的属性，进行一层包装
    for (let key in setupStore) {
        const prop = setupStore[key];
        if (typeof prop === 'function') {
            setupStore[key] = wrapAction(key, prop);
        }
    }

    function mergeReactiveObject(target, partailState) {
        for (let key in partailState) {
            // 如果不是自己自己属性，则直接跳过
            if (!partailState.hasOwnProperty(key)) continue;
            const oldValue = target[key];
            const newValue = partailState[key];
            if (isObject(oldValue) && isObject(newValue) && !isRef(newValue)) {
                target[key] = mergeReactiveObject(oldValue, newValue);
            } else {
                target[key] = newValue;
            }
        }
        return target;
    }

    function $patch(partailStateOrMutation) {
        if (typeof partailStateOrMutation === 'function') {
            // 当$patch 中传递的是一个函数时，会自动的给他传递一个store的参数。
            // 不需要手动的传入一个store
            partailStateOrMutation(store);
        } else {
            mergeReactiveObject(store, partailStateOrMutation);
        }
    }
    let actionSubscribes = [];
    const partialState = {
        $patch,
        $subscribe(callback, options) {
            scope.run(() =>
                watch(pinia.state.value[id], (state) => {
                    // 传递修改方式和最新值
                    // 如何活该修改方式呢？需要将这个type当作一个全局变量，记录type的改动过程
                    // 例如在patch中，如果传递的是一个函数，这这里的type则需要改成function
                    // 这里直接写死了
                    callback({ type: 'direc' }, state);
                })
            );
        },
        // 绑定参数, 调用onAction其实就是进行订阅
        $onAction: addSubscription.bind(null, actionSubscribes),
        $dispose: () => {
            scope.stop();
            actionSubscribes = [];
            pinia._s.delete(id); // 删除store
        },
    };
    // 创建一个store【reactive】，保存在pinia._s中，并返回
    const store = reactive(partialState);

    Object.defineProperty(store, '$state', {
        get: () => pinia.state.value[id],
        set: (state) => {
            $patch(($state) => Object.assign($state, state))
        },
    });

    // 每个store都调用一下plugin，并进行合并，达到状态进行全局共享
    Object.assign(store, setupStore);
    pinia._p.forEach((plugin) =>
        Object.assign(store, plugin({ store, pinia, app: pinia._a }))
    );


    pinia._s.set(id, store);
    return store;
}

function createOptionsStore(id, options, pinia) {
    // options API 一般包含 state， getters， action三个选项
    let { state, getters, actions } = options;

    function setup() {
        pinia.state.value[id] = state ? state() : {};

        // 如果reactive中的属性值是基本类型，此时computed就不会生效。
        // 因此需要使用toRefs进行包裹
        // const localState = toRefs(pinia.state.value[id]);
        const localState = state()
        return Object.assign(
            localState,
            actions,
            Object.keys(getters || {}).reduce((computedGetters, name) => {
                computedGetters[name] = computed(() => {
                    return getters[name].call(store, store);
                });
                return computedGetters;
            }, {})
        );
    }

    const store = createSetupStore(id, setup, pinia);

    store.$reset = function () {
        // 获取原始状态，并调用$patch 进行批量修改
        const newState = state ? state() : {};
        store.$patch(($state) => {
            Object.assign($state, newState);
        });
    };
    return store;
}

