import * as THREE from 'three';

export class UIModelPanelController {
    constructor(uiController) {
        // 부모 UI 컨트롤러 참조
        this.uiController = uiController;
        
        // 단축 참조 설정
        this.modelManager = uiController.modelManager;
        this.gridSystem = uiController.gridSystem;
        this.modelsList = document.getElementById('modelsList');
    }
    
    // 모델 선택 업데이트
    updateModelSelection(modelId) {
        document.querySelectorAll('.model-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        if (modelId !== null) {
            const modelElement = document.querySelector(`.model-item[data-model-id="${modelId}"]`);
            if (modelElement) {
                modelElement.classList.add('selected');
                modelElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
    
    // 모델 목록 UI 업데이트
    updateModelListUI() {
        const models = this.modelManager.getAllModels();
        const selectedModelId = this.modelManager.getSelectedModelId();
        
        this.modelsList.innerHTML = '';

        if (models.length === 0) {
            this.modelsList.innerHTML = '<p>로드된 모델이 없습니다.</p>';
            return;
        }

        models.forEach(model => {
            const modelElement = document.createElement('div');
            modelElement.className = 'model-item';
            if (selectedModelId === model.id) {
                modelElement.classList.add('selected');
            }
            if (model.isColliding) {
                modelElement.classList.add('collision');
            }
            modelElement.setAttribute('data-model-id', model.id);
            
            // 모델 선택 클릭 이벤트
            modelElement.addEventListener('click', (e) => {
                if (e.target === modelElement || e.target === modelElement.querySelector('.model-name')) {
                    this.modelManager.selectModel(model.id);
                }
            });
            
            // 모델 이름
            const nameElement = document.createElement('div');
            nameElement.className = 'model-name';
            nameElement.textContent = `모델: ${model.name}`;
            nameElement.style.fontWeight = 'bold';
            modelElement.appendChild(nameElement);
            
            // 애니메이션 컨트롤
            this.addAnimationControlsToModelElement(model, modelElement);
            
            // 위치 조정 컨트롤
            this.addPositionControlsToModelElement(model, modelElement);
            
            // 실제 단위 위치 표시 (그리드 배율 적용)
            this.addRealUnitPositionToModelElement(model, modelElement);
            
            // 원점으로부터의 거리 정보 표시
            this.addDistanceInfoToModelElement(model, modelElement);
            
            // 스케일 조정 컨트롤
            this.addScaleControlsToModelElement(model, modelElement);
            
            // 회전 컨트롤 추가
            this.addRotationControlsToModelElement(model, modelElement);
            
            // 모델 삭제 버튼
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '삭제';
            removeBtn.setAttribute('data-model-id', model.id);
            removeBtn.addEventListener('click', () => {
                const modelId = parseInt(removeBtn.getAttribute('data-model-id'));
                this.modelManager.removeModel(modelId);
            });
            modelElement.appendChild(removeBtn);
            
            this.modelsList.appendChild(modelElement);
        });
    }
    
    // 애니메이션 컨트롤 추가
    addAnimationControlsToModelElement(model, modelElement) {
        if (model.animations && model.animations.length > 0) {
            const animControlsElement = document.createElement('div');
            animControlsElement.className = 'model-controls';
            
            // 애니메이션 선택기
            const animSelector = document.createElement('select');
            animSelector.setAttribute('data-model-id', model.id);
            model.animations.forEach((animation, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = animation.name || `Animation ${index + 1}`;
                animSelector.appendChild(option);
            });
            animSelector.addEventListener('change', () => {
                const modelId = parseInt(animSelector.getAttribute('data-model-id'));
                const animIndex = parseInt(animSelector.value);
                this.modelManager.playModelAnimation(modelId, animIndex);
            });
            animControlsElement.appendChild(animSelector);
            
            // 재생 버튼
            const playBtn = document.createElement('button');
            playBtn.textContent = '재생';
            playBtn.setAttribute('data-model-id', model.id);
            playBtn.addEventListener('click', () => {
                const modelId = parseInt(playBtn.getAttribute('data-model-id'));
                this.modelManager.toggleModelAnimation(modelId, true);
            });
            animControlsElement.appendChild(playBtn);
            
            // 일시정지 버튼
            const pauseBtn = document.createElement('button');
            pauseBtn.textContent = '일시정지';
            pauseBtn.setAttribute('data-model-id', model.id);
            pauseBtn.addEventListener('click', () => {
                const modelId = parseInt(pauseBtn.getAttribute('data-model-id'));
                this.modelManager.toggleModelAnimation(modelId, false);
            });
            animControlsElement.appendChild(pauseBtn);
            
            modelElement.appendChild(animControlsElement);
        }
    }
    
    // 위치 컨트롤 추가
    addPositionControlsToModelElement(model, modelElement) {
        const positionElement = document.createElement('div');
        positionElement.className = 'position-controls';
        
        // X 위치
        const xLabel = document.createElement('label');
        xLabel.textContent = 'X:';
        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.step = '0.1';
        xInput.value = model.root.position.x.toFixed(1);
        xInput.setAttribute('data-model-id', model.id);
        xInput.setAttribute('data-axis', 'x');
        xInput.addEventListener('change', () => {
            const modelId = parseInt(xInput.getAttribute('data-model-id'));
            const axis = xInput.getAttribute('data-axis');
            const value = parseFloat(xInput.value);
            
            const success = this.modelManager.updateModelPosition(modelId, axis, value);
            if (success) {
                this.updateDistanceUI(modelId);
                this.updateRealUnitPositionUI(modelId);
            }
            if (!success) {
                // 충돌 시 이전 위치로 되돌리고 UI도 업데이트
                this.updatePositionUI(modelId);
            }
        });
        xLabel.appendChild(xInput);
        positionElement.appendChild(xLabel);
        
        // Y 위치 (읽기 전용)
        const yLabel = document.createElement('label');
        yLabel.textContent = 'Y:';
        const yInput = document.createElement('input');
        yInput.type = 'text';
        yInput.value = '0.0';
        yInput.readOnly = true;
        yInput.classList.add('readonly-input');
        yInput.setAttribute('data-model-id', model.id);
        yInput.setAttribute('data-axis', 'y');
        yLabel.appendChild(yInput);
        positionElement.appendChild(yLabel);
        
        // Z 위치
        const zLabel = document.createElement('label');
        zLabel.textContent = 'Z:';
        const zInput = document.createElement('input');
        zInput.type = 'number';
        zInput.step = '0.1';
        zInput.value = model.root.position.z.toFixed(1);
        zInput.setAttribute('data-model-id', model.id);
        zInput.setAttribute('data-axis', 'z');
        zInput.addEventListener('change', () => {
            const modelId = parseInt(zInput.getAttribute('data-model-id'));
            const axis = zInput.getAttribute('data-axis');
            const value = parseFloat(zInput.value);
            
            const success = this.modelManager.updateModelPosition(modelId, axis, value);
            if (success) {
                this.updateDistanceUI(modelId);
                this.updateRealUnitPositionUI(modelId);
            }
            if (!success) {
                // 충돌 시 이전 위치로 되돌리고 UI도 업데이트
                this.updatePositionUI(modelId);
            }
        });
        zLabel.appendChild(zInput);
        positionElement.appendChild(zLabel);
        
        modelElement.appendChild(positionElement);
    }
    
    // 실제 단위 위치 추가
    addRealUnitPositionToModelElement(model, modelElement) {
        if (this.gridSystem) {
            const realUnitPos = this.getRealUnitPosition(model);
            
            const realPositionElement = document.createElement('div');
            realPositionElement.className = 'position-info';
            realPositionElement.innerHTML = `
                <div><span class="position-label">실제 좌표:</span> X: <span class="position-value" data-model-id="${model.id}" data-position-type="real-x">${realUnitPos.x}</span>, Z: <span class="position-value" data-model-id="${model.id}" data-position-type="real-z">${realUnitPos.z}</span> m</div>
            `;
            modelElement.appendChild(realPositionElement);
        }
    }
    
    // 거리 정보 추가
    addDistanceInfoToModelElement(model, modelElement) {
        const distanceElement = document.createElement('div');
        distanceElement.className = 'distance-info';

        // 3D 거리 (X, Y, Z)
        const distance3D = this.modelManager.calculateDistanceToOrigin(model.id).toFixed(2);
        const distance3DElement = document.createElement('div');
        distance3DElement.innerHTML = `<span class="distance-label">원점으로부터 거리:</span> <span class="distance-value" data-model-id="${model.id}" data-distance-type="3d">${distance3D}</span> m`;
        distanceElement.appendChild(distance3DElement);

        // 수평 거리 (X, Z)
        const distanceHorizontal = this.modelManager.calculateHorizontalDistanceToOrigin(model.id).toFixed(2);
        const distanceHorizontalElement = document.createElement('div');
        distanceHorizontalElement.innerHTML = `<span class="distance-label">수평 거리(XZ):</span> <span class="distance-value" data-model-id="${model.id}" data-distance-type="horizontal">${distanceHorizontal}</span> m`;
        distanceElement.appendChild(distanceHorizontalElement);

        modelElement.appendChild(distanceElement);
    }
    
    // 스케일 컨트롤 추가
    addScaleControlsToModelElement(model, modelElement) {
        const scaleElement = document.createElement('div');
        scaleElement.className = 'scale-controls';

        // 스케일 레이블
        const scaleLabel = document.createElement('label');
        scaleLabel.textContent = '크기: ';

        // 스케일 입력 필드
        const scaleInput = document.createElement('input');
        scaleInput.type = 'number';
        scaleInput.min = '0.1';
        scaleInput.max = '5.0';
        scaleInput.step = '0.01';
        scaleInput.value = model.root.scale.x.toFixed(2); // 소수점 두 자리까지 표시
        scaleInput.setAttribute('data-model-id', model.id);
        scaleInput.addEventListener('change', () => {
            const modelId = parseInt(scaleInput.getAttribute('data-model-id'));
            const scale = parseFloat(scaleInput.value);
            
            if (scale > 0) {
                const success = this.modelManager.setModelScale(modelId, scale);
                if (!success) {
                    // 충돌 시 원래 값으로 복원
                    scaleInput.value = this.modelManager.getModelScale(modelId).toFixed(2);
                }
            }
        });
        scaleLabel.appendChild(scaleInput);
        scaleElement.appendChild(scaleLabel);

        // 축소 버튼 (-10%)
        const shrinkBtn = document.createElement('button');
        shrinkBtn.textContent = '축소 -10%';
        shrinkBtn.title = '모델 10% 축소';
        shrinkBtn.setAttribute('data-model-id', model.id);
        shrinkBtn.addEventListener('click', () => {
            const modelId = parseInt(shrinkBtn.getAttribute('data-model-id'));
            const success = this.modelManager.scaleModel(modelId, 0.9); // 10% 축소
            
            if (success) {
                // UI 업데이트
                this.updateScaleUI(modelId);
            }
        });
        scaleElement.appendChild(shrinkBtn);

        // 확대 버튼 (+10%)
        const growBtn = document.createElement('button');
        growBtn.textContent = '확대 +10%';
        growBtn.title = '모델 10% 확대';
        growBtn.setAttribute('data-model-id', model.id);
        growBtn.addEventListener('click', () => {
            const modelId = parseInt(growBtn.getAttribute('data-model-id'));
            const success = this.modelManager.scaleModel(modelId, 1.1); // 10% 확대
            
            if (success) {
                // UI 업데이트
                this.updateScaleUI(modelId);
            }
        });
        scaleElement.appendChild(growBtn);

        // 세밀한 스케일 조정을 위한 컨트롤 영역
        const fineScaleElement = document.createElement('div');
        fineScaleElement.className = 'fine-scale-controls';

        // 1% 축소 버튼
        const shrinkFineBtn = document.createElement('button');
        shrinkFineBtn.textContent = '-1%';
        shrinkFineBtn.title = '모델 1% 축소';
        shrinkFineBtn.setAttribute('data-model-id', model.id);
        shrinkFineBtn.addEventListener('click', () => {
            const modelId = parseInt(shrinkFineBtn.getAttribute('data-model-id'));
            const success = this.modelManager.scaleModel(modelId, 0.99); // 1% 축소
            
            if (success) {
                // UI 업데이트
                this.updateScaleUI(modelId);
            }
        });
        fineScaleElement.appendChild(shrinkFineBtn);

        // 1% 확대 버튼
        const growFineBtn = document.createElement('button');
        growFineBtn.textContent = '+1%';
        growFineBtn.title = '모델 1% 확대';
        growFineBtn.setAttribute('data-model-id', model.id);
        growFineBtn.addEventListener('click', () => {
            const modelId = parseInt(growFineBtn.getAttribute('data-model-id'));
            const success = this.modelManager.scaleModel(modelId, 1.01); // 1% 확대
            
            if (success) {
                // UI 업데이트
                this.updateScaleUI(modelId);
            }
        });
        fineScaleElement.appendChild(growFineBtn);

        scaleElement.appendChild(fineScaleElement);
        modelElement.appendChild(scaleElement);
    }
    
    // 회전 컨트롤 추가
    addRotationControlsToModelElement(model, modelElement) {
        const rotationElement = document.createElement('div');
        rotationElement.className = 'rotation-controls';

        // 반시계 방향으로 90도 회전 버튼
        const rotateLeftBtn = document.createElement('button');
        rotateLeftBtn.textContent = '↺ 90°';
        rotateLeftBtn.title = '반시계 방향으로 90도 회전';
        rotateLeftBtn.setAttribute('data-model-id', model.id);
        rotateLeftBtn.addEventListener('click', () => {
            const modelId = parseInt(rotateLeftBtn.getAttribute('data-model-id'));
            this.modelManager.rotateModelBy90Degrees(modelId, false);
        });
        rotationElement.appendChild(rotateLeftBtn);

        // 시계 방향으로 90도 회전 버튼
        const rotateRightBtn = document.createElement('button');
        rotateRightBtn.textContent = '↻ 90°';
        rotateRightBtn.title = '시계 방향으로 90도 회전';
        rotateRightBtn.setAttribute('data-model-id', model.id);
        rotateRightBtn.addEventListener('click', () => {
            const modelId = parseInt(rotateRightBtn.getAttribute('data-model-id'));
            this.modelManager.rotateModelBy90Degrees(modelId, true);
        });
        rotationElement.appendChild(rotateRightBtn);

        modelElement.appendChild(rotationElement);
    }
    
    // 위치 UI 업데이트
    updatePositionUI(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return;

        const xInput = document.querySelector(`input[data-model-id="${modelId}"][data-axis="x"]`);
        const zInput = document.querySelector(`input[data-model-id="${modelId}"][data-axis="z"]`);

        if (xInput) xInput.value = model.root.position.x.toFixed(1);
        if (zInput) zInput.value = model.root.position.z.toFixed(1);
    }
    
    // 실제 단위 위치 UI 업데이트
    updateRealUnitPositionUI(modelId) {
        if (!this.gridSystem) return;
        
        const model = this.modelManager.getModel(modelId);
        if (!model) return;
        
        const realUnitPos = this.getRealUnitPosition(model);
        
        const realXElem = document.querySelector(`span[data-model-id="${modelId}"][data-position-type="real-x"]`);
        const realZElem = document.querySelector(`span[data-model-id="${modelId}"][data-position-type="real-z"]`);
        
        if (realXElem) realXElem.textContent = realUnitPos.x;
        if (realZElem) realZElem.textContent = realUnitPos.z;
    }
    
    // 스케일 UI 업데이트
    updateScaleUI(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return;

        const scaleInput = document.querySelector(`input[data-model-id="${modelId}"][type="number"]`);
        if (scaleInput) {
            scaleInput.value = model.root.scale.x.toFixed(2);
        }
    }
    
    // 거리 정보 UI 업데이트
    updateDistanceUI(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return;
        
        // 3D 거리 업데이트
        const distance3DElement = document.querySelector(`span.distance-value[data-model-id="${modelId}"][data-distance-type="3d"]`);
        if (distance3DElement) {
            const distance3D = this.modelManager.calculateDistanceToOrigin(modelId).toFixed(2);
            distance3DElement.textContent = distance3D;
        }
        
        // 수평 거리 업데이트
        const distanceHorizontalElement = document.querySelector(`span.distance-value[data-model-id="${modelId}"][data-distance-type="horizontal"]`);
        if (distanceHorizontalElement) {
            const distanceHorizontal = this.modelManager.calculateHorizontalDistanceToOrigin(modelId).toFixed(2);
            distanceHorizontalElement.textContent = distanceHorizontal;
        }
    }
    
    // 모델의 실제 단위 위치 계산 (그리드 배율 반영)
    getRealUnitPosition(model) {
        if (!model || !this.gridSystem) return { x: '0.0', z: '0.0' };
        
        const position = model.root.position;
        
        // 이미 씬의 좌표가 미터 단위이므로 단위 변환 없이 사용
        return {
            x: position.x.toFixed(2),
            z: position.z.toFixed(2)
        };
    }
}