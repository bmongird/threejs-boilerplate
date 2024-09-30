const keys = {
    'w': false,
    'a': false,
    's': false,
    'd': false,
    'shift': false,
    ' ': false, // Space for jump
    'e': false
};

document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key.toLowerCase())) {
        keys[event.key.toLowerCase()] = false;
    }
});

export function getMovementState() {
    return {
        isMovingForward: keys['w'],
        isMovingBackward: keys['s'],
        isMovingLeft: keys['a'],
        isMovingRight: keys['d'],
        isJumping: keys[' '],
        isSprinting: keys['shift']
    };
}