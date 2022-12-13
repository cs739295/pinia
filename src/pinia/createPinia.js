import { effectScope, markRaw, ref } from 'vue';
import { SymbolPinia } from './rootStore';

export function createPinia() {
    const scope = effectScope();
    const state = scope.run(() => {
        return ref({});
    });
    const _p = [];

    // 被包裹的对象后续不应该被代理，因此用markRaw标记一下
    const pinia = markRaw({
        install(app) {
            pinia._a = app;
            // 在app.use的时候，通过provide注入。
            // 当useStore的时候inject。让所有的组件都能够使用
            app.provide(SymbolPinia, pinia);
            // 为了兼容vue2的写法，使用this能够使用pinia
            app.config.globalProperties.$pinia = pinia;
        },
        // pinia的插件体系
        use(plugin) {
            _p.push(plugin);
            return this;
        },
        _p,
        _a: null, // 保存vue创建的app，其实就是Vue根实例
        _e: scope, // 记录scope 作用域
        state, // 记录所有的state
        _s: new Map(), // 记录所有的store
    });

    return pinia;
}
