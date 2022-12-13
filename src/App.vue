<script setup>
import { useCounterStore } from './stores/counter';
import {pinia} from './main'
const store = useCounterStore();

const { increment } = store;

const handleClick = () => {
    // let fruits = [...store.fruits, '栗子']

    // store.$patch(() =>{

    //   store.count++;
    //   store.fruits.push('栗子')

    // })
    increment();

    // store.$reset();
};
store.$onAction(({ after, onError, name, store }) => {
    after((value) => {
        console.log('action 执行了：', name);
        console.log('action 执行后的返回值:', value);
    });
});
console.log(pinia)
</script>

<template>
    计数器： {{ store.count }}
    <br />

    双倍： {{ store.doubleCount }}
    <br />

    <button @click="handleClick">点击增加</button>

    <div v-for="item in store.fruits" :key="item">{{ item }}</div>
</template>

<style scoped></style>
