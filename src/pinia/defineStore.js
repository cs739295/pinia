import { effectScope, getCurrentInstance, inject, reactive, computed, isReactive, isRef, toRefs, watch } from 'vue';
import { piniaSymbol } from './rootStore';
import { addSubscription, triggerSubscription } from './pubSub';
import { setActivePinia, activePinia } from './createPinia'

function isComputed(value) {
    return !!(value && isRef(value) && value.effect);
}

function isObject(value) {
    return !!(value && typeof value === 'object' && value !== null)
}

function mergeReactiveObject(target, state) {
    // 改变的是state中的值
    for (let key in state) {
        // 如果不是自己自己属性，则直接跳过
        if (!state.hasOwnProperty(key)) continue;
        const oldValue = target[key];
        const newValue = state[key];
        if (isObject(oldValue) && isObject(newValue) && !isRef(newValue)) {
            target[key] = mergeReactiveObject(oldValue, newValue);
        } else {
            target[key] = newValue;
        }
    }
    return target;
}




function createSetupStore(id, setup, pinia, isOption = false) {
    let scope;

    // 后续一些不是用户定义的属性和方法，而是系统内置的api会增加到这个store上

    function $patch(partailStateOrMutation) {
        if (typeof partailStateOrMutation === 'function') {
            // 当$patch 中传递的是一个函数时，会自动的给他传递一个store的参数。
            // 不需要手动的传入一个store
            partailStateOrMutation(pinia.state.value[id]);
        } else {
            mergeReactiveObject(pinia.state.value[id], partailStateOrMutation);
        }
    }

    let actionSubscribes = [];
    const partialState = {
        $patch,
        $subscribe(callback, options = {}) {
            scope.run(() =>
                watch(pinia.state.value[id], (state) => {
                    callback({ storeId: id }, state);
                })
            );
        },
        $onAction: addSubscription.bind(null, actionSubscribes),
        $dispose: () => {
            // 调用store上的依赖收集
            scope.stop();
            actionSubscribes = [];
            pinia._s.delete(id); // 删除store
        },
    }

    const store = reactive(partialState);

    const initialState = pinia.state.value[id];

    if (!initialState && !isOption) {
        pinia.state.value[id] = {}
    }

    const setupStore = pinia._e.run(() => {
        scope = effectScope();

        return scope.run(() => setup())
    })


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
        }
    }

    for (const key in setupStore) {
        const prop = setupStore[key];

        if (typeof prop === 'function') {
            setupStore[key] = wrapAction(key, prop)
        }

        if (isRef(prop) && !isComputed(prop) || isReactive(prop)) {

            if (!isOption) {
                pinia.state.value[id][key] = prop;

            }
        }
    }

    pinia._s.set(id, store)
    store.$id = id;

    pinia._p.forEach((plugin) =>
        // plugin中返回值时，将返回值合并到store中
        Object.assign(store, plugin({ store, pinia, app: pinia._a }))
    );

    // 合并一下
    Object.assign(store, setupStore);

    Object.defineProperty(store, '$state', {
        get: () => pinia.state.value[id],
        set: (state) => {
            $patch(($state) => Object.assign($state, state))
        },
    });




    return store;
}


function createOptionsStore(id, options, pinia) {

    const { state, getters, actions } = options;

    // 处理 state getters actions;
    function setup() {
        pinia.state.value[id] = state ? state() : {};

        // $patch 中修改的是pinia.state.value 中的经过reactive之后的值，而在组件中使用的是一个Object.assign 合并后的值。
        // 因此修改pinia.state.value 中的count 并不会使得store.count改变。
        const localState = toRefs(pinia.state.value[id])

        return Object.assign(
            localState, // 用户状态
            actions, // 用户动作
            Object.keys(getters || {}).reduce((memo, name) => { // 用户计算属性
                memo[name] = computed(() => {
                    return getters[name].call(store, store)
                })
                return memo
            }, {})
        );
    }



    const store = createSetupStore(id, setup, pinia, true)

    store.$reset = function () {
        const newState = state ? state() : {};
        store.$patch((state) => {
            Object.assign(state, newState)
        })
    }

    return store;


}

export function defineStore(idOrOptions, setup) {
    let id;
    let options;

    if (typeof idOrOptions === 'string') {
        id = idOrOptions;
        options = setup;
    } else {
        options = idOrOptions;
        id = idOrOptions.id;
    }

    const isSetupStore = typeof options === 'function';



    function useStore() {
        let instance = getCurrentInstance();

        let pinia = instance && inject(piniaSymbol);


        if (pinia) {
            setActivePinia(pinia)
        }

        pinia = activePinia;

        if (!pinia._s.has(id)) {

            if (isSetupStore) {
                createSetupStore(id, options, pinia, false)
            } else {
                // 建立id 与 store中间的映射
                createOptionsStore(id, options, pinia, true)
            }


        }

        const store = pinia._s.get(id);


        return store;


    }

    return useStore;
}