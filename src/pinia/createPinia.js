import { effectScope, markRaw, ref } from 'vue';
import { piniaSymbol } from './rootStore'

export let activePinia;

export function setActivePinia(pinia) {
    activePinia = pinia;
}

export function createPinia() {
    const scope = effectScope();
    const state = scope.run(() => {
        return ref({});
    });
    const _p = [];

    const pinia = markRaw({
        _s: new Map(), // 保存所有的store (counter1 -> store1)
        install(app) {

            setActivePinia(pinia)
            pinia._a = app;
            // 在app.use的时候，通过provide注入。
            // 当useStore的时候inject。让所有的组件都能够使用
            app.provide(piniaSymbol, pinia);
            // 为了兼容vue2的写法，使用this能够使用pinia
            app.config.globalProperties.$pinia = pinia;

        },
        // pinia的插件体系
        use(plugin) {
            _p.push(plugin);
            return this;
        },
        _p,
        _a: null,
        _e: scope,
        state,

    })

    return pinia
}