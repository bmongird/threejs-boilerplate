import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getMovementState } from './controls.js';


class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.sun = null;
        this.mixer = null;
        this.animations = null;
        this.clock = null;
        this.rooms = [];

        // Ammo.js variables
        this.Ammo = null;
        this.physicsWorld = null;
        this.rigidBodies = [];
        this.tmpTrans = null;
        this.playerBody = null;

        this.walls = [];
        this.transparentMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            transparent: true,
            opacity: 1
        });
    }

    async init() {
        try {
            await this.loadAmmo();
            console.log("Ammo.js loaded successfully");
            this.setupPhysicsWorld();
            
            this.clock = new THREE.Clock();

            // Scene setup
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87ceeb);

            // Camera setup
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(5, 15, 30);

            // Renderer setup
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            document.body.appendChild(this.renderer.domElement);

            this.createRooms();
            await this.loadPlayer();
            this.addLights();

            window.addEventListener('resize', () => this.onWindowResize(), false);

            this.animate();
        } catch (error) {
            console.error("Error during initialization:", error);
        }
    }

    async loadAmmo() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = '/ammo.js';
            script.onload = () => {
                Ammo().then((AmmoLib) => {
                    this.Ammo = AmmoLib;
                    resolve();
                });
            };
            document.body.appendChild(script);
        });
    }

    // Setting up physics engine
    setupPhysicsWorld() {
        let collisionConfiguration = new this.Ammo.btDefaultCollisionConfiguration();
        let dispatcher = new this.Ammo.btCollisionDispatcher(collisionConfiguration);
        let overlappingPairCache = new this.Ammo.btDbvtBroadphase();
        let solver = new this.Ammo.btSequentialImpulseConstraintSolver();

        this.physicsWorld = new this.Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
        this.physicsWorld.setGravity(new this.Ammo.btVector3(0, -20, 0));

        this.tmpTrans = new this.Ammo.btTransform();
    }

    // Creating some rooms
    createRooms() {
        const roomSize = 50;
        const wallHeight = 20;
        const wallThickness = 1;
        const doorWidth = 10;
        const doorHeight = 15;
    
        for (let i = 0; i < 3; i++) {
            const room = new THREE.Group();
            
            // Floor
            this.createBox(roomSize, 1, roomSize, i * roomSize, -0.5, 0, 0xcccccc, false);
            
            // Walls
            this.createWallWithDoor(wallThickness, wallHeight, roomSize, i * roomSize - roomSize/2, wallHeight/2, 0, 0x000000, false, 'left', i === 0);
            this.createWallWithDoor(wallThickness, wallHeight, roomSize, i * roomSize + roomSize/2, wallHeight/2, 0, 0x000000, false, 'right', i === 2);
            this.createBox(roomSize, wallHeight, wallThickness, i * roomSize, wallHeight/2, -roomSize/2, 0x000000, false);
            this.createBox(roomSize, wallHeight, wallThickness, i * roomSize, wallHeight/2, roomSize/2, 0x000000, false, true);
    
            this.scene.add(room);
            this.rooms.push(room);
        }
    
        // Reference object (if needed)
        this.createBox(2, 2, 2, 0, 1, 0, 0x00FF22);
    }
    
    createWallWithDoor(width, height, depth, x, y, z, color, physics, side, isEndWall) {
        const doorWidth = 10;
        const doorHeight = 15;
        const wallSegments = new THREE.Group();
    
        if (isEndWall) {
            this.createBox(width, height, depth, x, y, z, color, physics);
        } else {
            const wallLength = depth;
            const topHeight = height - doorHeight;
            const sideWidth = (wallLength - doorWidth) / 2;
    
            this.createBox(width, topHeight, wallLength, x, y + doorHeight / 2, z, color, physics);
            this.createBox(width, doorHeight, sideWidth, x, y-2.5, z - wallLength / 4 - doorWidth / 4, color, physics);
            this.createBox(width, doorHeight, sideWidth, x, y-2.5, z + wallLength / 4 + doorWidth / 4, color, physics);
        }
    
        this.scene.add(wallSegments);
    }

    

    createBox(width, height, depth, x, y, z, color, dynamic = true, opaque = false) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geometry, this.transparentMaterial.clone());
        mesh.material.color.set(color);
        mesh.material.opacity = opaque ? 0.5 : 1;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.walls.push(mesh);

        const shape = new this.Ammo.btBoxShape(new this.Ammo.btVector3(width * 0.5, height * 0.5, depth * 0.5));
        const mass = dynamic ? 1 : 0;
        const transform = new this.Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new this.Ammo.btVector3(x, y, z));
        const motionState = new this.Ammo.btDefaultMotionState(transform);
        const localInertia = new this.Ammo.btVector3(0, 0, 0);
        if (dynamic) shape.calculateLocalInertia(mass, localInertia);

        const rbInfo = new this.Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
        const body = new this.Ammo.btRigidBody(rbInfo);

        this.physicsWorld.addRigidBody(body);

        if (dynamic) {
            body.setActivationState(4); // DISABLE_DEACTIVATION
            this.rigidBodies.push({ mesh: mesh, body: body });
        }
    }

    // Loading and setting up physics for player model (with a cylinder physics body)
    async loadPlayer() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                '/assets/models/Adventurer.glb', // Ensure this path is correct
                (gltf) => {
                    this.player = gltf.scene;
                    this.player.position.set(15, 0, 5); // Start in the middle of the first room
                    this.player.scale.set(5, 5, 5);
                    this.player.traverse((node) => {
                        if (node.isMesh) {
                            node.castShadow = true;
                        }
                    });
                    this.scene.add(this.player);

                    // Create player physics body
                    const radius = 1;
                    const height = 8;
                    const shape = new this.Ammo.btCylinderShape(new this.Ammo.btVector3(radius, height / 2, radius));
                    const mass = 1;
                    const transform = new this.Ammo.btTransform();
                    transform.setIdentity();
                    transform.setOrigin(new this.Ammo.btVector3(15, 3, 5)); 
                    const motionState = new this.Ammo.btDefaultMotionState(transform);
                    const localInertia = new this.Ammo.btVector3(0, 0, 0);
                    shape.calculateLocalInertia(mass, localInertia);

                    const rbInfo = new this.Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
                    this.playerBody = new this.Ammo.btRigidBody(rbInfo);
                    this.playerBody.setActivationState(4); // DISABLE_DEACTIVATION
                    this.playerBody.setAngularFactor(new this.Ammo.btVector3(0, 0, 0)); // Prevent player from falling over
                    this.physicsWorld.addRigidBody(this.playerBody);



                    // Add a wireframe for the player's physics body (debugging purposes)
                    const geometry = new THREE.CylinderGeometry(radius, radius, height, 16); // Cylinder for wireframe
                    const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
                    this.playerWireframe = new THREE.Mesh(geometry, wireframeMaterial);
                    this.playerWireframe.position.set(15, height / 2, 5); // Start position same as player
                    this.scene.add(this.playerWireframe); // Add wireframe to the scene


                    // Set up animations
                    this.mixer = new THREE.AnimationMixer(this.player);
                    this.animations = {};
                    gltf.animations.forEach((clip) => {
                        const action = this.mixer.clipAction(clip);
                        this.animations[clip.name] = action;
                    });

                    console.log("Available animations:", Object.keys(this.animations));
                    resolve();
                },
                (xhr) => {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                (error) => {
                    console.error('An error happened', error);
                    reject(error);
                }
            );
        });
    }

    // Adding lights to the scene
    addLights() {
        const ambientLight = new THREE.AmbientLight(0xFFF000, 0.3);
        this.scene.add(ambientLight);

        this.sun = new THREE.PointLight(0xffffff, 30000, 1000);
        this.sun.position.set(50, 100, 50);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 500;
        this.scene.add(this.sun);
    }

    // Main animation loop
    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        this.updatePhysics(deltaTime);

        if (this.player && this.mixer && this.playerBody) {
            this.updatePlayerPosition();
            this.updateAnimation();
            this.mixer.update(deltaTime);

            // Update camera position to follow player
            const cameraOffset = new THREE.Vector3(7, 30, 25);
            this.camera.position.copy(this.player.position).add(cameraOffset);
            this.camera.lookAt(this.player.position);
        }

        this.renderer.render(this.scene, this.camera);
    }

    updatePhysics(deltaTime) {
        this.physicsWorld.stepSimulation(deltaTime, 10);

        // This handles syncing the Three.js meshes with the physics bodies
        for (let i = 0; i < this.rigidBodies.length; i++) {
            let objThree = this.rigidBodies[i].mesh;
            let objAmmo = this.rigidBodies[i].body;
            let ms = objAmmo.getMotionState();
            if (ms) {
                ms.getWorldTransform(this.tmpTrans);
                let p = this.tmpTrans.getOrigin();
                let q = this.tmpTrans.getRotation();
                objThree.position.set(p.x(), p.y(), p.z());
                objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
            }
        }

        // Ditto above but for player debug wireframe
        if (this.playerBody && this.playerWireframe) {
            let ms = this.playerBody.getMotionState();
            if (ms) {
                ms.getWorldTransform(this.tmpTrans);
                let p = this.tmpTrans.getOrigin();
                let q = this.tmpTrans.getRotation();
                this.playerWireframe.position.set(p.x(), p.y(), p.z());
                this.playerWireframe.quaternion.set(q.x(), q.y(), q.z(), q.w());
            }
        }
    }


    // Handles player movement and rotation
    updatePlayerPosition() {
        const { isMovingForward, isMovingBackward, isMovingLeft, isMovingRight, isJumping, isSprinting } = getMovementState();
        
        const normalMoveForce = 100; // Normal movement force
        const sprintMoveForce = 200; // Sprint movement force
        const jumpForce = 100; 
        const normalMaxSpeed = 5; // Normal maximum speed of the player
        const sprintMaxSpeed = 10; // Sprint maximum speed of the player
        const damping = 0.9; // Damping factor to quickly slow down the player when no keys are pressed
        const rotationSpeed = 0.05;
    
        const playerYOffset = 3.9; 
    
        // Determine the current move force and max speed based on sprint state
        const moveForce = isSprinting ? sprintMoveForce : normalMoveForce;
        const maxSpeed = isSprinting ? sprintMaxSpeed : normalMaxSpeed;
    
        let moveX = 0;
        let moveZ = 0;
    
        // Get the current velocity
        const velocity = this.playerBody.getLinearVelocity();
    
        if (isMovingForward) moveZ = 1;
        if (isMovingBackward) moveZ = -1;
        if (isMovingLeft) this.player.rotation.y += rotationSpeed;
        if (isMovingRight) this.player.rotation.y -= rotationSpeed;
        if (isJumping && this.player.position.y < 1) this.playerBody.applyCentralForce(new Ammo.btVector3(0, jumpForce, 0));
    
        // Apply movement in player's forward direction
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.quaternion);
        moveX = forward.x * moveZ;
        moveZ = forward.z * moveZ;
    
        // Apply force for movement
        const movement = new Ammo.btVector3(moveX * moveForce, 0, moveZ * moveForce);
        this.playerBody.applyCentralForce(movement);
    
        // Limit speed
        const speed = velocity.length();
        if (speed > maxSpeed) {
            const scaleFactor = maxSpeed / speed;
            velocity.setX(velocity.x() * scaleFactor);
            velocity.setZ(velocity.z() * scaleFactor);
            this.playerBody.setLinearVelocity(velocity);
        }
    
        // Apply damping when no movement keys are pressed
        if (!isMovingForward && !isMovingBackward) {
            velocity.setX(velocity.x() * damping);
            velocity.setZ(velocity.z() * damping);
            this.playerBody.setLinearVelocity(velocity);
        }
    
        // Update player rotation
        const transform = new Ammo.btTransform();
        this.playerBody.getMotionState().getWorldTransform(transform);
        const rotation = new Ammo.btQuaternion(
            this.player.quaternion.x,
            this.player.quaternion.y,
            this.player.quaternion.z,
            this.player.quaternion.w
        );
        transform.setRotation(rotation);
        this.playerBody.getMotionState().setWorldTransform(transform);
    
        // Update Three.js object position
        const position = this.playerBody.getWorldTransform().getOrigin();
        this.player.position.set(position.x(), position.y()-playerYOffset, position.z());
    
        Ammo.destroy(movement);
        Ammo.destroy(rotation);
    }

    // Updates character animation based on movement state
    updateAnimation() {
        if (!this.mixer || !this.animations) return;
    
        const { isMovingForward, isMovingBackward, isJumping, isSprinting } = getMovementState();
    
        const fadeTime = 0.2; // Time in seconds for crossfading between animations
    
        let newAnimation = 'CharacterArmature|Idle';
    
        if (isJumping) {
            newAnimation = 'Jump';
        } else if (isMovingForward) {
            newAnimation = isSprinting ? 'CharacterArmature|Run' : 'CharacterArmature|Walk';
        } else if (isMovingBackward) {
            newAnimation = 'CharacterArmature|Run_Back';
        }
    
        // If the new animation is different from the current one, crossfade to it
        if (newAnimation !== this.currentAnimation) {
            const newAction = this.animations[newAnimation];
            const oldAction = this.animations[this.currentAnimation];
    
            if (newAction && oldAction) {
                newAction.reset();
                newAction.setEffectiveTimeScale(1);
                newAction.setEffectiveWeight(1);
                newAction.crossFadeFrom(oldAction, fadeTime, true);
                newAction.play();
            } else if (newAction) {
                newAction.reset().play();
            }
    
            this.currentAnimation = newAnimation;
        }
    
        // Update the mixer
        const deltaTime = this.clock.getDelta();
        this.mixer.update(deltaTime);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Create and initialize the game
const game = new Game();
game.init();