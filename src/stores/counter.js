// import { defineStore} from 'pinia';
import { defineStore } from '../pinia';
import { computed, reactive, toRefs } from 'vue';

export const useCounterStore = defineStore('counter', {
    state: () => {
        return {
            count: 0,
            fruits: ['香蕉', '苹果'],
        };
    },
    getters: {
        doubleCount: (store) => {
            return store.count * 2;
        },
    },
    actions: {
        increment(name) {
            console.log(name)
            this.count++;
            this.fruits.push('栗子');
            return 123;
        },
    },
});

export const useCounter1Store = defineStore('counter1', () => {
    const state = reactive({
        count: 0
    });

    const doubleCount = computed(() => {
        return state.count * 2;
    })

    const increment = () => {
        state.count++;
    }

    return {
        ...toRefs(state),
        increment,
        doubleCount
    }
})
