import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelManager {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
        this.gridSystem = null; // 그리드 시스템 참조
        this.models = [];
        this.nextModelId = 0;
        this.selectedModelId = null;
        this.selectedObject = null;
        
        // 선택 상자
        this.selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffff00);
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);
        
        // 이벤트 리스너들을 위한 참조 저장
        this.onModelLoaded = null;
        this.onModelSelect = null;
        this.onModelsChanged = null;
        
        // 그리드 경계 이탈 메시지
        this.gridBoundaryMessage = document.getElementById('gridBoundaryMessage');
        this.gridBoundaryMessageTimeout = null;
    }

    // 그리드 시스템 설정
    setGridSystem(gridSystem) {
        this.gridSystem = gridSystem;
    }

    // 콜백 설정
    setCallbacks(onModelLoaded, onModelSelect, onModelsChanged) {
        this.onModelLoaded = onModelLoaded;
        this.onModelSelect = onModelSelect;
        this.onModelsChanged = onModelsChanged;
    }

    // 모델 로드
    loadModel(fileURL, modelName) {
        const modelId = this.nextModelId++;
        const loadingElement = document.getElementById('loading');
        loadingElement.style.display = 'block';
        
        const loader = new GLTFLoader();
        
        loader.load(
            fileURL,
            (gltf) => {
                // 바운딩 박스 계산
                const boundingBox = new THREE.Box3().setFromObject(gltf.scene);
                const boxSize = boundingBox.getSize(new THREE.Vector3());
                const boxCenter = boundingBox.getCenter(new THREE.Vector3());
                
                // 바운딩 박스보다 약간 큰 투명한 선택용 메시 생성
                const selectionGeometry = new THREE.BoxGeometry(
                    boxSize.x * 1.05, 
                    boxSize.y * 1.05, 
                    boxSize.z * 1.05
                );
                const selectionMaterial = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: 0.1, // 약간 보이게 설정 (디버깅용)
                    depthWrite: false
                });
                const selectionMesh = new THREE.Mesh(selectionGeometry, selectionMaterial);
                
                // 선택용 메시에 모델 ID 할당
                selectionMesh.userData.modelId = modelId;
                selectionMesh.userData.isSelectionProxy = true;
                
                // 메인 그룹 생성
                const modelRoot = new THREE.Group();
                modelRoot.name = `model-${modelId}`;
                
                // 모델 씬의 위치를 조정 (바운딩 박스 중심을 원점으로)
                gltf.scene.position.sub(boxCenter);
                
                // 충돌 감지용 메시 생성 및 추가
                const collisionMesh = this.collisionManager.createCollisionDebugMesh({ id: modelId }, boundingBox);
                
                // 씬과 선택용 메시, 충돌 메시를 그룹에 추가
                modelRoot.add(gltf.scene);
                modelRoot.add(selectionMesh);
                modelRoot.add(collisionMesh);
                
                // 모델 데이터 객체 생성
                const modelData = {
                    id: modelId,
                    name: modelName,
                    root: modelRoot,
                    selectionMesh: selectionMesh,
                    collisionMesh: collisionMesh,
                    boundingBox: new THREE.Box3(),
                    originalModel: gltf.scene,
                    animations: gltf.animations,
                    mixer: null,
                    currentAction: null,
                    isColliding: false,
                    size: boxSize.clone()  // 모델 크기 저장
                };
                
                // 모든 하위 객체에 모델 ID 설정
                gltf.scene.traverse((node) => {
                    node.userData.modelId = modelId;
                    node.userData.modelName = modelName;
                    
                    // 개별 메시 설정
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        
                        // 재질 설정 개선
                        if (node.material) {
                            // 단일 재질인 경우
                            this.enhanceMaterial(node.material);
                        } else if (node.materials && Array.isArray(node.materials)) {
                            // 다중 재질인 경우
                            node.materials.forEach(material => this.enhanceMaterial(material));
                        }
                        
                        // 기하학적 문제 해결
                        if (node.geometry) {
                            // 법선 재계산 (렌더링 품질 향상)
                            if (!node.geometry.attributes.normal) {
                                node.geometry.computeVertexNormals();
                            }
                            
                            // 버텍스 색상이 없는 경우 추가 (양면 렌더링에서의 음영 처리 개선)
                            if (!node.geometry.attributes.color) {
                                const positions = node.geometry.attributes.position;
                                const colors = new Float32Array(positions.count * 3);
                                for (let i = 0; i < positions.count; i++) {
                                    colors[i * 3] = 1;
                                    colors[i * 3 + 1] = 1;
                                    colors[i * 3 + 2] = 1;
                                }
                                node.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                            }
                        }
                    }
                });
                
                // 그룹 자체에도 모델 ID 설정
                modelRoot.userData.modelId = modelId;
                modelRoot.userData.modelName = modelName;
                modelRoot.userData.isModelRoot = true;
                
                // 초기 위치 설정 (그리드 영역 내로 제한)
                let initialPosition = new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    0,
                    (Math.random() - 0.5) * 5
                );
                
                // 그리드 경계 내로 조정
                if (this.gridSystem) {
                    // 모델의 크기 절반을 버퍼로 사용하여 경계에 닿지 않게 함
                    const buffer = Math.max(boxSize.x, boxSize.z) / 2;
                    initialPosition = this.gridSystem.clampToBoundary(initialPosition, buffer);
                }
                
                modelRoot.position.copy(initialPosition);
                
                // 초기 스케일 설정
                modelRoot.scale.set(1, 1, 1);
                
                // 애니메이션 설정
                if (gltf.animations && gltf.animations.length > 0) {
                    modelData.mixer = new THREE.AnimationMixer(gltf.scene);
                    modelData.currentAction = modelData.mixer.clipAction(gltf.animations[0]);
                    modelData.currentAction.play();
                }
                
                // 씬에 추가
                this.scene.add(modelRoot);
                
                // 모델 목록에 추가
                this.models.push(modelData);
                
                // 충돌 관리자에 모델 목록 업데이트
                this.collisionManager.setModels(this.models);
                
                // 바운딩 박스 초기화
                this.collisionManager.updateModelBoundingBox(modelData);
                
                // 모델 가시성 향상
                this.enhanceModelMaterials(modelData);
                
                // 로딩 숨기기
                loadingElement.style.display = 'none';
                
                // 콜백 호출
                if (this.onModelLoaded) {
                    this.onModelLoaded(modelData);
                }
                
                // 새 모델 선택
                this.selectModel(modelId);
                
                // 충돌 감지
                this.collisionManager.checkAllCollisions();
                
                console.log(`모델 "${modelName}" (ID: ${modelId}) 로드 완료`);
            },
            (xhr) => {
                // 로딩 진행률
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                loadingElement.textContent = `로딩 중... ${Math.round(percentComplete)}%`;
            },
            (error) => {
                console.error('모델 로드 중 오류 발생:', error);
                loadingElement.textContent = '모델 로드 중 오류가 발생했습니다.';
                setTimeout(() => {
                    loadingElement.style.display = 'none';
                }, 3000);
            }
        );
        
        return modelId;
    }

    // 모델 선택
    selectModel(modelId) {
        // 이전 선택 지우기
        this.selectedObject = null;
        this.selectedModelId = null;
        this.selectionBox.visible = false;

        // 새 모델 찾기
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;

        // 선택 설정
        this.selectedObject = model.root;
        this.selectedModelId = modelId;

        // 모델을 포함하는 경계 박스 표시
        this.selectionBox.setFromObject(model.root);
        this.selectionBox.visible = true;
        
        // 콜백 호출
        if (this.onModelSelect) {
            this.onModelSelect(modelId);
        }
        
        console.log(`모델 "${model.name}" (ID: ${modelId}) 선택됨`);
        return true;
    }

    // 선택 해제
    clearSelection() {
        this.selectedObject = null;
        this.selectedModelId = null;
        this.selectionBox.visible = false;
        
        // 콜백 호출
        if (this.onModelSelect) {
            this.onModelSelect(null);
        }
    }

    // 모델 위치 업데이트
    updateModelPosition(modelId, axis, value) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;

        // 이전 위치 저장
        const previousPosition = model.root.position.clone();

        // Y축은 항상 0으로 고정
        if (axis === 'y') {
            model.root.position.y = 0;
            return true;
        } else {
            // 새 위치 계산
            const newPosition = model.root.position.clone();
            newPosition[axis] = parseFloat(value);
            
            // 그리드 경계 확인
            if (this.gridSystem) {
                // 모델의 크기 절반을 버퍼로 사용
                const buffer = Math.max(model.size.x, model.size.z) / 2;
                
                // 경계 내부인지 확인
                if (!this.gridSystem.isWithinBoundary(newPosition, buffer)) {
                    // 경계 내부로 조정
                    const clampedPosition = this.gridSystem.clampToBoundary(newPosition, buffer);
                    newPosition.copy(clampedPosition);
                    
                    // 경계 초과 메시지 표시
                    this.showGridBoundaryMessage();
                }
            }
            
            // 충돌 검사
            const canMove = this.collisionManager.checkMoveCollision(model, newPosition, previousPosition);
            
            if (!canMove) {
                return false;
            }
        }

        // 경계 박스 업데이트
        if (this.selectedModelId === modelId && this.selectionBox.visible) {
            this.selectionBox.update();
        }
        
        return true;
    }

    // 그리드 경계 메시지 표시
    showGridBoundaryMessage() {
        if (this.gridBoundaryMessage) {
            this.gridBoundaryMessage.style.display = 'block';
            
            // 기존 타임아웃 취소
            if (this.gridBoundaryMessageTimeout) {
                clearTimeout(this.gridBoundaryMessageTimeout);
            }
            
            // 2초 후 메시지 숨기기
            this.gridBoundaryMessageTimeout = setTimeout(() => {
                this.gridBoundaryMessage.style.display = 'none';
            }, 2000);
        }
    }

    // 드래그 이동 처리
    moveSelectedModel(newPosition, previousPosition) {
        if (!this.selectedObject || this.selectedModelId === null) return false;
        
        const model = this.models.find(m => m.id === this.selectedModelId);
        if (!model) return false;
        
        // 새 위치 적용 (Y값은 0으로 고정)
        newPosition.y = 0;
        
        // 그리드 경계 확인
        if (this.gridSystem) {
            // 모델의 크기 절반을 버퍼로 사용
            const buffer = Math.max(model.size.x, model.size.z) / 2;
            
            // 경계 내부인지 확인
            if (!this.gridSystem.isWithinBoundary(newPosition, buffer)) {
                // 경계 내부로 조정
                const clampedPosition = this.gridSystem.clampToBoundary(newPosition, buffer);
                newPosition.copy(clampedPosition);
                
                // 경계 초과 메시지 표시
                this.showGridBoundaryMessage();
            }
        }
        
        // 충돌 검사
        const canMove = this.collisionManager.checkMoveCollision(model, newPosition, previousPosition);
        
        if (canMove) {
            // 선택 상자 업데이트
            if (this.selectionBox.visible) {
                this.selectionBox.update();
            }
            
            return true;
        }
        
        return false;
    }

    // 모든 모델 지우기
    clearAllModels() {
        this.models.forEach(model => {
            this.scene.remove(model.root);
        });
        this.models = [];
        this.collisionManager.setModels(this.models);
        
        // 선택 해제
        this.clearSelection();
        
        // 콜백 호출
        if (this.onModelsChanged) {
            this.onModelsChanged();
        }
    }

    // 모델 제거
    removeModel(modelId) {
        const modelIndex = this.models.findIndex(m => m.id === modelId);
        if (modelIndex === -1) return false;

        const model = this.models[modelIndex];
        this.scene.remove(model.root);

        // 모델 배열에서 제거
        this.models.splice(modelIndex, 1);

        // 충돌 관리자에 모델 목록 업데이트
        this.collisionManager.setModels(this.models);

        // 선택된 모델 제거 시 선택 해제
        if (this.selectedModelId === modelId) {
            this.clearSelection();
        }

        // 콜백 호출
        if (this.onModelsChanged) {
            this.onModelsChanged();
        }

        // 충돌 감지 업데이트
        this.collisionManager.checkAllCollisions();
        
        return true;
    }

    // 모든 모델 위치 검증 및 필요 시 조정
    validateAllModelsPosition() {
        if (!this.gridSystem) return;
        
        let anyModelAdjusted = false;
        
        this.models.forEach(model => {
            // 모델의 크기 절반을 버퍼로 사용
            const buffer = Math.max(model.size.x, model.size.z) / 2;
            
            // 현재 위치가 그리드 경계 내에 있는지 확인
            if (!this.gridSystem.isWithinBoundary(model.root.position, buffer)) {
                // 이전 위치 저장
                const previousPosition = model.root.position.clone();
                
                // 경계 내부로 조정
                const clampedPosition = this.gridSystem.clampToBoundary(model.root.position, buffer);
                model.root.position.copy(clampedPosition);
                
                // 바운딩 박스 업데이트
                this.collisionManager.updateModelBoundingBox(model);
                
                anyModelAdjusted = true;
            }
        });
        
        // 위치 조정된 모델이 있으면 충돌 검사 다시 실행
        if (anyModelAdjusted) {
            this.collisionManager.checkAllCollisions();
            
            // 경계 초과 메시지 표시
            this.showGridBoundaryMessage();
            
            // 선택된 모델의 UI 업데이트
            if (this.selectedModelId !== null && this.onModelSelect) {
                this.onModelSelect(this.selectedModelId);
            }
        }
    }

    // 애니메이션 재생
    playModelAnimation(modelId, animIndex) {
        const model = this.models.find(m => m.id === modelId);
        if (!model || !model.mixer || !model.animations || model.animations.length === 0) return false;

        // 이전 애니메이션 정지
        if (model.currentAction) {
            model.currentAction.stop();
        }

        // 새 애니메이션 설정 및 재생
        const animation = model.animations[animIndex];
        if (animation) {
            model.currentAction = model.mixer.clipAction(animation);
            model.currentAction.reset();
            model.currentAction.play();
            return true;
        }
        
        return false;
    }

    // 애니메이션 토글
    toggleModelAnimation(modelId, play) {
        const model = this.models.find(m => m.id === modelId);
        if (!model || !model.currentAction) return false;

        if (play) {
            model.currentAction.paused = false;
            model.currentAction.play();
        } else {
            model.currentAction.paused = true;
        }
        
        return true;
    }

    // 모델 가져오기
    getModel(modelId) {
        return this.models.find(m => m.id === modelId);
    }

    // 모든 모델 가져오기
    getAllModels() {
        return this.models;
    }
    
    // 선택된 모델 ID 가져오기
    getSelectedModelId() {
        return this.selectedModelId;
    }
    
    // 선택된 모델 객체 가져오기
    getSelectedObject() {
        return this.selectedObject;
    }
    
    // 애니메이션 및 업데이트
    update(delta) {
        // 애니메이션 믹서 업데이트
        this.models.forEach(model => {
            if (model.mixer) {
                model.mixer.update(delta);
            }
        });
        
        // 선택 박스 업데이트
        if (this.selectionBox.visible) {
            this.selectionBox.update();
        }
    }

    // 모델 회전 처리
    rotateModel(modelId, angle) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;

        // 이전 회전 값 저장
        const previousRotation = model.root.rotation.clone();
        
        // 새 회전 값 계산 (Y축 기준 회전)
        const newRotation = model.root.rotation.clone();
        newRotation.y += angle * (Math.PI / 180); // 각도를 라디안으로 변환
        
        // 회전 적용
        model.root.rotation.copy(newRotation);
        
        // 충돌 검사 (회전 후 충돌 발생시 이전 상태로 복원)
        this.collisionManager.updateModelBoundingBox(model);
        const collisionDetected = this.collisionManager.checkAllCollisions();
        
        if (collisionDetected && model.isColliding) {
            model.root.rotation.copy(previousRotation);
            this.collisionManager.updateModelBoundingBox(model);
            this.collisionManager.checkAllCollisions();
            return false;
        }
        
        // 선택 상자 업데이트
        if (this.selectedModelId === modelId && this.selectionBox.visible) {
            this.selectionBox.update();
        }
        
        return true;
    }

    // 모델을 90도씩 회전
    rotateModelBy90Degrees(modelId, clockwise = true) {
        // 90도 또는 -90도 회전 (시계/반시계 방향)
        const angle = clockwise ? 90 : -90;
        return this.rotateModel(modelId, angle);
    }

    // 모델 스케일 설정
    setModelScale(modelId, scale) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;
        
        // 스케일 값이 유효한지 확인 (0보다 커야 함)
        if (scale <= 0) return false;
        
        // 이전 스케일 저장
        const previousScale = model.root.scale.clone();
        
        // 새 스케일 적용
        model.root.scale.set(scale, scale, scale);
        
        // 바운딩 박스 업데이트 및 충돌 검사
        this.collisionManager.updateModelBoundingBox(model);
        
        // 그리드 경계 검사
        if (this.gridSystem) {
            // 스케일이 변경되면 새로운 크기 계산
            const newSize = model.size.clone().multiplyScalar(scale);
            const buffer = Math.max(newSize.x, newSize.z) / 2;
            
            // 현재 위치가 새 크기로 그리드 경계를 벗어나는지 확인
            if (!this.gridSystem.isWithinBoundary(model.root.position, buffer)) {
                // 이전 스케일로 복원
                model.root.scale.copy(previousScale);
                this.collisionManager.updateModelBoundingBox(model);
                this.showGridBoundaryMessage();
                return false;
            }
        }
        
        const collisionDetected = this.collisionManager.checkAllCollisions();
        
        // 충돌이 있고 이 모델이 충돌 중이면 이전 스케일로 복원
        if (collisionDetected && model.isColliding) {
            model.root.scale.copy(previousScale);
            this.collisionManager.updateModelBoundingBox(model);
            this.collisionManager.checkAllCollisions();
            return false;
        }
        
        // 선택 상자 업데이트
        if (this.selectedModelId === modelId && this.selectionBox.visible) {
            this.selectionBox.update();
        }
        
        return true;
    }

    // 모델 스케일 증가/감소
    scaleModel(modelId, factor) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return false;
        
        // 현재 스케일에 factor를 곱함 (x, y, z 모두 동일하게 처리)
        const currentScale = model.root.scale.x;
        const newScale = currentScale * factor;
        
        return this.setModelScale(modelId, newScale);
    }

    // 모델 스케일 가져오기
    getModelScale(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return null;
        
        // x, y, z 스케일이 모두 같다고 가정
        return model.root.scale.x;
    }

    // 모델 재질 설정 향상
    enhanceModelMaterials(model) {
        if (!model || !model.originalModel) return;
        
        model.originalModel.traverse((node) => {
            if (node.isMesh) {
                // 머티리얼 최적화
                if (node.material) {
                    // 단일 재질인 경우
                    this.enhanceMaterial(node.material);
                } else if (node.materials && Array.isArray(node.materials)) {
                    // 다중 재질인 경우
                    node.materials.forEach(material => this.enhanceMaterial(material));
                }
            }
        });
    }

    enhanceMaterial(material) {
        if (!material) return;
        
        // 원거리에서도 잘 보이도록 발광 속성 추가
        material.emissive = material.emissive || new THREE.Color(0x222222);
        
        // 양면 렌더링 활성화 (뒷면에서도 볼 수 있게)
        material.side = THREE.DoubleSide;
        
        // 투명도 설정 개선
        if (material.transparent) {
            // 이미 투명한 재질인 경우, 최소 투명도 보장
            material.opacity = Math.max(0.8, material.opacity);
            // 알파 테스트 값 설정 (매우 투명한 부분은 완전히 투명하게)
            material.alphaTest = 0.01;
        } else {
            // 투명하지 않은 재질의 경우 완전 불투명으로 설정
            material.transparent = false;
            material.opacity = 1.0;
        }
        
        // 먼 거리에서도 선명하게 보이도록 함
        material.dithering = true;
        
        // 깊이 테스트 설정
        material.depthTest = true;
        // 깊이 쓰기 설정 (투명하지 않은 객체는 깊이 버퍼에 기록)
        material.depthWrite = !material.transparent;
        
        // 폴리곤 오프셋 설정 (z-fighting 방지)
        material.polygonOffset = true;
        material.polygonOffsetFactor = 1;
        material.polygonOffsetUnits = 1;
        
        // 렌더링 품질 향상
        if (material.map) {
            // 텍스처가 있는 경우 필터링 품질 향상
            material.map.anisotropy = 16;
            material.map.minFilter = THREE.LinearMipmapLinearFilter;
            material.map.magFilter = THREE.LinearFilter;
        }
    }

    // 모델과 원점 사이의 거리 계산
    calculateDistanceToOrigin(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return null;
        
        // 원점 (0,0,0)과 모델 위치 사이의 거리 계산
        const position = model.root.position;
        
        // 3D 거리 계산: sqrt(x^2 + y^2 + z^2)
        const distance = Math.sqrt(
            Math.pow(position.x, 2) + 
            Math.pow(position.y, 2) + 
            Math.pow(position.z, 2)
        );
        
        return distance;
    }

    // X, Z 평면상의 거리 계산 (수직 거리 Y 제외)
    calculateHorizontalDistanceToOrigin(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return null;
        
        // 원점 (0,0,0)과 모델 위치 사이의 수평 거리 계산 (Y 무시)
        const position = model.root.position;
        
        // 2D 거리 계산: sqrt(x^2 + z^2)
        const distance = Math.sqrt(
            Math.pow(position.x, 2) + 
            Math.pow(position.z, 2)
        );
        
        return distance;
    }
    
    // 그리드 설정이 변경될 때 현재 선택된 모델의 위치 정보 UI 업데이트
    updateSelectedModelPositionUI() {
        if (this.selectedModelId !== null && this.onModelSelect) {
            this.onModelSelect(this.selectedModelId);
        }
    }
}