import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
// import { createPinia } from 'pinia';
import { createPinia } from './pinia'

import { useCounterStore } from './stores/counter'

export const pinia = createPinia();

const app = createApp(App);

pinia.use(({ store }) => {
    let local = localStorage.getItem(store.$id + 'PINIA_STATE');

    if (local) {
        store.$state = JSON.parse(local);
    } else {
        store.$subscribe(({ storeId: id }, state) => {
            console.log('state changed')
            localStorage.setItem(id + 'PINIA_STATE', JSON.stringify(state));
        })
    }

    store.$onAction(() => { // 埋点
        console.log('action done')
    })


    return { a: 1 }
})

app.use(pinia)

const store = useCounterStore();
console.log(store.count)





app.mount('#app');
