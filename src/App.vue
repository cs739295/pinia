<script setup>
import { useCounter1Store, useCounterStore } from './stores/counter';
import { pinia } from './main';
const store = useCounterStore();
const store1 = useCounter1Store();

const { increment } = store;
const { increment: increment1 } = store1;

const handleClick = () => {
    store.$patch((store) => {
        store.count = 100
    })

    // increment('chengshun05');
};

const handleClick1 = () => {
    increment1('chengshun051');
};

const handleReset = () => {
    store.$reset();
};

store1.$subscribe((storeInfo, state) => {
    console.log(state, storeInfo);
});

store1.$onAction(({ after, onError }) => {
    console.log('action running', store.count);

    after(() => {
        console.log('action after', store.count);
    });

    onError((err) => {
        console.log('erroe', err);
    });
});

console.log(store1, store);
</script>

<template>
    计数器： {{ store.count }}
    <br />

    双倍： {{ store.doubleCount }}
    <br />

    <button @click="handleClick">点击增加</button>
    <button @click="handleReset">重置</button>

    <div v-for="item in store.fruits" :key="item">{{ item }}</div>

    <br />
    <div>-----------------------------------------------</div>

    计数器： {{ store1.count }}
    <br />

    双倍： {{ store1.doubleCount }}
    <br />

    <button @click="handleClick1">点击增加</button>

    <div v-for="item in store1.fruits" :key="item">{{ item }}</div>
</template>

<style scoped></style>
