// 订阅
export function addSubscription(subscriptions, cb) {
    subscriptions.push(cb);
    return function removeSubscription() {
        const idx = subscriptions.indexOf(cb);
        if (idx !== -1) {
            subscriptions.splice(idx, 1);
        }
    };
}

// 发布
export function triggerSubscription(subscriptions, ...args) {
    subscriptions.forEach((cb) => cb(...args));
}
