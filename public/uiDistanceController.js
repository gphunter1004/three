import * as THREE from 'three';

export class UIDistanceController {
    constructor(eventController) {
        // 부모 이벤트 컨트롤러 참조
        this.eventController = eventController;
        
        // 단축 참조 설정
        this.uiController = eventController.uiController;
        this.modelManager = eventController.modelManager;
        this.scene = eventController.scene;
        
        // 기준점 관련 변수
        this.referencePointVisible = false;
        this.referencePointGroup = null;
    }
    
    // 이벤트 리스너 설정
    setupEventListeners() {
        // 필요한 경우 여기에 특정 이벤트 리스너 추가
    }
    
    // 거리 계산 기준점 토글 처리
    handleReferencePointToggle(event) {
        this.referencePointVisible = event.target.checked;
        
        if (this.referencePointVisible) {
            // 각 모델에 기준점 추가
            this.addReferencePointsToModels();
        } else {
            // 모든 모델에서 기준점 제거
            this.removeReferencePointsFromModels();
        }
    }
    
    // 각 모델에 기준점 추가
    addReferencePointsToModels() {
        // 기존 기준점 제거
        this.removeReferencePointsFromModels();
        
        // 기준점 그룹 생성 (전체 관리용)
        this.referencePointGroup = new THREE.Group();
        this.referencePointGroup.name = 'referencePointGroup';
        this.scene.add(this.referencePointGroup);
        
        // 모든 모델에 기준점 추가
        const models = this.modelManager.getAllModels();
        models.forEach(model => {
            this.addReferencePointToModel(model);
        });
    }
    
    // 단일 모델에 기준점 추가
    addReferencePointToModel(model) {
        if (!model || !model.root || !this.referencePointGroup) return;
        
        // 모델별 기준점 그룹 생성
        const modelRefGroup = new THREE.Group();
        modelRefGroup.name = `refPoint-${model.id}`;
        
        // 기준점 표시 (깃발 모양)
        const flagGroup = this.createFlagPole();
        
        // 기준점 그룹에 모델 ID 저장 (나중에 찾기 쉽게)
        flagGroup.userData.modelId = model.id;
        
        // 모델 위치에 맞게 조정
        flagGroup.position.set(model.root.position.x, 0, model.root.position.z);
        
        // 모델 레이블 추가
        const labelSprite = this.createModelLabel(model);
        flagGroup.add(labelSprite);
        
        // 다른 모델과의 거리 측정선 생성
        this.createDistanceLinesForModel(model, flagGroup);
        
        // 기준점 그룹에 추가
        modelRefGroup.add(flagGroup);
        this.referencePointGroup.add(modelRefGroup);
    }
    
    // 깃발 폴대 생성 함수
    createFlagPole() {
        const flagGroup = new THREE.Group();
        
        // 깃대
        const poleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
        const poleMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.y = 0.75; // 중심점이 정 가운데이므로 절반만큼 올림
        flagGroup.add(pole);
        
        // 깃발
        const flagGeometry = new THREE.PlaneGeometry(0.5, 0.3);
        const flagMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            side: THREE.DoubleSide
        });
        const flag = new THREE.Mesh(flagGeometry, flagMaterial);
        flag.position.set(0.25, 1.3, 0); // 깃대 상단에 위치
        flagGroup.add(flag);
        
        // 기준점 구체 (깃대 하단)
        const sphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.y = 0.08; // 약간 바닥에서 띄움
        flagGroup.add(sphere);
        
        return flagGroup;
    }
    
    // 모델 레이블 생성
    createModelLabel(model) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        // 모델 이름 표시
        context.fillStyle = 'white';
        context.font = 'Bold 24px Arial';
        context.textAlign = 'center';
        context.fillText(model.name, 128, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(0, 1.8, 0); // 깃발 위에 표시
        sprite.scale.set(2, 1, 1);
        
        return sprite;
    }
    
    // 특정 모델에 대한 거리 측정선 생성
    createDistanceLinesForModel(targetModel, flagGroup) {
        const models = this.modelManager.getAllModels();
        const selectedModelId = this.modelManager.getSelectedModelId();
        
        models.forEach(otherModel => {
            // 자기 자신과는 연결하지 않음
            if (otherModel.id === targetModel.id) return;
            
            // 선 이름 생성 (모델 ID 쌍을 정렬하여 동일한 연결에 대해 동일한 이름 보장)
            const modelIds = [targetModel.id, otherModel.id].sort((a, b) => a - b);
            const lineName = `distanceLine-${modelIds[0]}-${modelIds[1]}`;
            
            // 이미 이 모델 쌍에 대한 거리 선이 있는지 확인
            const existingLine = this.referencePointGroup.getObjectByName(lineName);
            if (existingLine) return; // 이미 존재하면 스킵
            
            // 모델 간 거리 선 생성
            const lineGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(6); // 시작점과 끝점 (x, y, z)
            
            // 시작점 (현재 모델 위치)
            positions[0] = targetModel.root.position.x;
            positions[1] = 0.1; // 바닥보다 약간 위로
            positions[2] = targetModel.root.position.z;
            
            // 끝점 (다른 모델 위치)
            positions[3] = otherModel.root.position.x;
            positions[4] = 0.1; // 바닥보다 약간 위로
            positions[5] = otherModel.root.position.z;
            
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            // 두 모델 중 하나가 선택된 경우 강조
            const isSelected = (targetModel.id === selectedModelId || otherModel.id === selectedModelId);
            const color = isSelected ? 0xffff00 : 0xaaaaaa;
            
            const lineMaterial = new THREE.LineDashedMaterial({
                color: color,
                dashSize: 0.2,
                gapSize: 0.1,
                linewidth: 1
            });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.computeLineDistances(); // 점선을 위해 필요
            line.name = lineName;
            line.userData.modelIds = modelIds;
            
            // 두 모델 간의 거리 계산
            const distance = this.calculateDistanceBetweenModels(targetModel, otherModel);
            
            // 거리 레이블 추가
            this.addDistanceBetweenModelsLabel(line, targetModel, otherModel, distance);
            
            // 기준점 그룹에 추가 (모델 내부가 아닌 전체 그룹에 추가하여 두 번 생성 방지)
            this.referencePointGroup.add(line);
        });
    }
    
    // 모델 간 거리 계산
    calculateDistanceBetweenModels(model1, model2) {
        const pos1 = model1.root.position;
        const pos2 = model2.root.position;
        
        // 수평 거리 계산 (XZ 평면)
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) + 
            Math.pow(pos2.z - pos1.z, 2)
        );
    }
    
    // 모델 간 거리 레이블 추가
// 모델 간 거리 레이블 추가
addDistanceBetweenModelsLabel(line, model1, model2, distance) {
    // 두 모델 사이의 중간 지점 계산
    const midPoint = new THREE.Vector3(
        (model1.root.position.x + model2.root.position.x) / 2,
        0.5, // 바닥에서 약간 띄움
        (model1.root.position.z + model2.root.position.z) / 2
    );
    
    // 캔버스 생성 및 텍스트 그리기
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // 선택된 모델에 연결된 레이블인 경우 강조
    const selectedModelId = this.modelManager.getSelectedModelId();
    const isSelected = (model1.id === selectedModelId || model2.id === selectedModelId);
    const color = isSelected ? 'rgba(255, 255, 0, 0.9)' : 'rgba(255, 255, 255, 0.7)';
    
    context.fillStyle = color;
    context.font = 'Bold 20px Arial';
    context.textAlign = 'center';
    context.fillText(`${distance.toFixed(2)}m`, 128, 32);
    
    // 레이블 스프라이트 생성
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: false // 항상 카메라에 보이도록
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(midPoint);
    sprite.scale.set(2, 0.5, 1);
    
    const labelName = `distanceLabel-${model1.id}-${model2.id}`;
    sprite.name = labelName;
    
    line.add(sprite);
}

// 거리 측정 선 및 레이블 업데이트
updateDistanceLines() {
    if (!this.referencePointGroup) return;
    
    const models = this.modelManager.getAllModels();
    const selectedModelId = this.modelManager.getSelectedModelId();
    
    // 모든 모델의 기준점 위치 업데이트
    models.forEach(model => {
        const refPointName = `refPoint-${model.id}`;
        const refPointGroup = this.referencePointGroup.getObjectByName(refPointName);
        
        if (refPointGroup && refPointGroup.children.length > 0) {
            const flagGroup = refPointGroup.children[0];
            // 기준점 위치 업데이트
            flagGroup.position.set(model.root.position.x, 0, model.root.position.z);
        }
    });
    
    // 모든 거리 선 업데이트
    this.referencePointGroup.children.forEach(child => {
        // 거리 선만 처리
        if (child.name && child.name.startsWith('distanceLine-')) {
            const modelIds = child.userData.modelIds;
            if (!modelIds || modelIds.length !== 2) return;
            
            // 관련 모델 찾기
            const model1 = this.modelManager.getModel(modelIds[0]);
            const model2 = this.modelManager.getModel(modelIds[1]);
            
            if (!model1 || !model2) return;
            
            // 선 위치 업데이트
            const positions = child.geometry.attributes.position.array;
            
            // 시작점 업데이트
            positions[0] = model1.root.position.x;
            positions[1] = 0.1; // 바닥보다 약간 위로
            positions[2] = model1.root.position.z;
            
            // 끝점 업데이트
            positions[3] = model2.root.position.x;
            positions[4] = 0.1; // 바닥보다 약간 위로
            positions[5] = model2.root.position.z;
            
            child.geometry.attributes.position.needsUpdate = true;
            child.computeLineDistances(); // 점선 업데이트를 위해 필요
            
            // 두 모델 중 하나가 선택된 경우 강조
            const isSelected = (model1.id === selectedModelId || model2.id === selectedModelId);
            const color = isSelected ? 0xffff00 : 0xaaaaaa;
            child.material.color.set(color);
            
            // 레이블 업데이트
            const labelSprite = child.children[0];
            if (labelSprite) {
                // 위치 업데이트
                labelSprite.position.set(
                    (model1.root.position.x + model2.root.position.x) / 2,
                    0.5,
                    (model1.root.position.z + model2.root.position.z) / 2
                );
                
                // 거리 계산
                const distance = this.calculateDistanceBetweenModels(model1, model2);
                
                // 텍스트 업데이트
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 64;
                
                const color = isSelected ? 'rgba(255, 255, 0, 0.9)' : 'rgba(255, 255, 255, 0.7)';
                
                context.fillStyle = color;
                context.font = 'Bold 20px Arial';
                context.textAlign = 'center';
                context.fillText(`${distance.toFixed(2)}m`, 128, 32);
                
                // 텍스처 업데이트
                if (labelSprite.material.map) {
                    labelSprite.material.map.dispose();
                }
                
                labelSprite.material.map = new THREE.CanvasTexture(canvas);
                labelSprite.material.needsUpdate = true;
            }
        }
    });
}

// 모든 모델에서 기준점 제거
removeReferencePointsFromModels() {
    if (this.referencePointGroup) {
        // 모든 오브젝트의 지오메트리와 재질 정리
        this.referencePointGroup.traverse(child => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        if (material.map) material.map.dispose();
                        material.dispose();
                    });
                } else {
                    if (child.material.map) {
                        child.material.map.dispose();
                    }
                    child.material.dispose();
                }
            }
        });
        
        // 씬에서 제거
        this.scene.remove(this.referencePointGroup);
        this.referencePointGroup = null;
    }
}

// 업데이트 (매 프레임 호출)
update() {
    // 거리 계산 기준점이 표시되어 있고 모델이 추가/변경된 경우 업데이트
    if (this.referencePointVisible && this.referencePointGroup) {
        const models = this.modelManager.getAllModels();
        
        // 각 모델에 대해 기준점이 있는지 확인
        models.forEach(model => {
            const refPointName = `refPoint-${model.id}`;
            const refPoint = this.referencePointGroup.getObjectByName(refPointName);
            
            // 기준점이 없으면 추가
            if (!refPoint) {
                this.addReferencePointToModel(model);
                
                // 기존의 다른 모델들과의 거리 선 생성
                const flagGroup = this.referencePointGroup.getObjectByName(refPointName)?.children[0];
                if (flagGroup) {
                    this.createDistanceLinesForModel(model, flagGroup);
                }
            }
        });
    }
}
}