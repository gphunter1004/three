import * as THREE from 'three';

/**
 * 바닥 도형 및 그리드 시스템
 * 사용자 지정 크기의 바닥 도형과 이동 가능한 그리드를 관리합니다.
 */
export class FloorPlanSystem {
    constructor(scene, gridSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem; // 기존 그리드 시스템 참조
        
        // 바닥 도형 관련 변수
        this.floorMesh = null;
        this.floorWidth = 20; // 기본 가로 크기를 20m로 변경
        this.floorDepth = 20; // 기본 세로 크기를 20m로 변경
        
        // 그리드 관련 변수
        this.floorGrid = null;
        this.gridLeftOffset = 1.0;  // 좌측 오프셋 (m)
        this.gridTopOffset = 1.0;   // 상단 오프셋 (m)
        
        // 크기 측정 화살표 관련 변수
        this.dimensionArrows = new THREE.Group();
        this.dimensionArrows.name = 'dimensionArrows';
        this.dimensionTexts = new THREE.Group();
        this.dimensionTexts.name = 'dimensionTexts';
        
        // 모서리 간 거리 화살표 관련 변수
        this.cornerArrows = new THREE.Group();
        this.cornerArrows.name = 'cornerArrows';
        this.cornerTexts = new THREE.Group();
        this.cornerTexts.name = 'cornerTexts';
        
        // 이동 모드 관련 변수
        this.moveMode = false;
        this.selectedObject = null;
        this.isDragging = false;
        this.dragStartPoint = new THREE.Vector3();
        this.objectStartPosition = new THREE.Vector3();
        
        // 초기화
        this.initialize();
    }
    
    /**
     * 초기화
     */
    initialize() {
        // 바닥 도형 생성 (먼저 생성)
        this.createFloorPlan(this.floorWidth, this.floorDepth);
        
        // 그리드 생성 (바닥 생성 후)
        this.createGrid();
        
        // 크기 측정 화살표 생성
        this.createDimensionArrows();
        
        // 모서리 간 거리 화살표 생성
        this.createCornerArrows();
        
        // 씬에 추가
        this.scene.add(this.dimensionArrows);
        this.scene.add(this.dimensionTexts);
        this.scene.add(this.cornerArrows);
        this.scene.add(this.cornerTexts);
    }
    
    /**
     * 바닥 도형 생성
     */
    createFloorPlan(width, height) {
        // 기존 바닥 도형 제거
        if (this.floorMesh) {
            this.scene.remove(this.floorMesh);
            if (this.floorMesh.geometry) this.floorMesh.geometry.dispose();
            if (this.floorMesh.material) this.floorMesh.material.dispose();
        }
        
        // 새 크기 저장
        this.floorWidth = width;
        this.floorDepth = height;
        
        // 바닥 도형 생성 (색상 없이 반투명한 흰색 사용)
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,  // 흰색
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.3,     // 매우 투명하게
            roughness: 0.7,
            metalness: 0.1
        });
        
        this.floorMesh = new THREE.Mesh(geometry, material);
        this.floorMesh.rotation.x = -Math.PI / 2; // 바닥에 평행하게
        this.floorMesh.position.y = 0.01; // 그리드보다 살짝 위에 배치
        this.floorMesh.name = 'floorPlan';
        this.floorMesh.userData.isFloorPlan = true;
        this.floorMesh.userData.isDraggable = false; // 바닥은 이동 불가능
        
        // 씬에 추가
        this.scene.add(this.floorMesh);
        
        // 크기 측정 화살표 업데이트
        this.updateDimensionArrows();
        
        // 그리드 재생성 (바닥 크기가 변경되면 그리드도 업데이트)
        if (this.floorGrid) {
            this.createGrid();
        }
        
        // 모서리 간 거리 화살표 업데이트
        this.updateCornerArrows();
        
        return this.floorMesh;
    }
    
    /**
     * 그리드 생성 (새로운 방식)
     */
    createGrid() {
        // 기존 그리드 제거
        if (this.floorGrid) {
            this.scene.remove(this.floorGrid);
            // 그리드 내부 요소들의 리소스 해제
            this.floorGrid.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // 새로운 그리드 그룹 생성
        this.floorGrid = new THREE.Group();
        this.floorGrid.name = 'floorGrid';
        
        // 바닥 위치 및 크기 가져오기
        const floorPosition = this.floorMesh ? this.floorMesh.position.clone() : new THREE.Vector3(0, 0, 0);
        const floorWidth = this.floorWidth;
        const floorDepth = this.floorDepth;
        
        // 바닥의 왼쪽 상단 모서리 계산 (중심점 기준)
        const leftTopCorner = new THREE.Vector3(
            floorPosition.x - floorWidth/2,  // 왼쪽
            floorPosition.y,                 // 높이 유지
            floorPosition.z + floorDepth/2   // 상단
        );
        
        // 그리드 원점 계산 (좌측 오프셋과 상단 오프셋 적용)
        const gridOrigin = new THREE.Vector3(
            leftTopCorner.x + this.gridLeftOffset,  // 왼쪽에서 오프셋만큼 이동
            leftTopCorner.y + 0.05,                 // 바닥보다 약간 위에
            leftTopCorner.z - this.gridTopOffset    // 상단에서 오프셋만큼 이동 (Z축 방향은 반대)
        );
        
        // 그리드 크기 (바닥 크기에서 좌측과 상단 오프셋 제외)
        const gridWidth = floorWidth - this.gridLeftOffset;
        const gridDepth = floorDepth - this.gridTopOffset;
        
        // 그리드 셀 크기 설정
        const cellSize = 1.0; // 1m 단위 그리드 셀
        
        // 그리드 라인 생성
        const gridLines = new THREE.Group();
        
        // 가로줄 (X축 방향)
        const horizontalCount = Math.ceil(gridDepth / cellSize) + 1;
        for (let i = 0; i < horizontalCount; i++) {
            const z = gridOrigin.z - i * cellSize; // 위에서 아래로
            
            const lineGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                gridOrigin.x, gridOrigin.y, z,
                gridOrigin.x + gridWidth, gridOrigin.y, z
            ]);
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            // 원점(첫 번째 줄)인 경우 빨간색, 그 외는 회색
            const color = (i === 0) ? 0xff0000 : 0x888888;
            const lineMaterial = new THREE.LineBasicMaterial({ color: color });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData.isGridLine = true;
            gridLines.add(line);
            
            // 그리드 선 번호 표시 (홀수 번호만)
            if (i % 2 === 0 || i === 0) {
                const label = this.createGridLabel(`${i}m`, gridOrigin.x - 0.3, gridOrigin.y, z);
                gridLines.add(label);
            }
        }
        
        // 세로줄 (Z축 방향)
        const verticalCount = Math.ceil(gridWidth / cellSize) + 1;
        for (let i = 0; i < verticalCount; i++) {
            const x = gridOrigin.x + i * cellSize; // 왼쪽에서 오른쪽으로
            
            const lineGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                x, gridOrigin.y, gridOrigin.z,
                x, gridOrigin.y, gridOrigin.z - gridDepth
            ]);
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            // 원점(첫 번째 줄)인 경우 초록색, 그 외는 회색
            const color = (i === 0) ? 0x00ff00 : 0x888888;
            const lineMaterial = new THREE.LineBasicMaterial({ color: color });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData.isGridLine = true;
            gridLines.add(line);
            
            // 그리드 선 번호 표시 (홀수 번호만)
            if (i % 2 === 0 || i === 0) {
                const label = this.createGridLabel(`${i}m`, x, gridOrigin.y, gridOrigin.z + 0.3);
                gridLines.add(label);
            }
        }
        
        // 그리드 정보 레이블 추가
        const infoLabel = this.createTextLabel(
            `그리드 원점: 좌측 ${this.gridLeftOffset}m, 상단 ${this.gridTopOffset}m\n셀 크기: ${cellSize}m × ${cellSize}m`,
            gridOrigin.x + gridWidth/2, gridOrigin.y, gridOrigin.z - gridDepth - 0.5
        );
        
        // 그리드에 요소 추가
        this.floorGrid.add(gridLines);
        this.floorGrid.add(infoLabel);
        
        // 그리드에 드래그 속성 추가
        this.floorGrid.userData.isFloorGrid = true;
        this.floorGrid.userData.isDraggable = true; // 그리드는 이동 가능
        
        // 그리드 원점 표시 (빨간색 구체)
        const originMarker = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        originMarker.position.copy(gridOrigin);
        this.floorGrid.add(originMarker);
        
        // 씬에 추가
        this.scene.add(this.floorGrid);
        
        // 모서리 간 거리 화살표 업데이트
        this.updateCornerArrows();
        
        return this.floorGrid;
    }
    
    /**
     * 그리드 숫자 레이블 생성
     */
    createGridLabel(text, x, y, z) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0)'; // 투명 배경
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.font = 'Bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, z);
        sprite.scale.set(0.5, 0.5, 1);
        
        return sprite;
    }
    
    /**
     * 텍스트 레이블 생성
     */
    createTextLabel(text, x, y, z) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // 배경
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 텍스트
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.font = 'Bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // 여러 줄 텍스트 처리
        const lines = text.split('\n');
        const lineHeight = 30;
        const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
        
        lines.forEach((line, i) => {
            context.fillText(line, canvas.width / 2, startY + i * lineHeight);
        });
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x, y, z);
        sprite.scale.set(3, 0.75, 1);
        
        return sprite;
    }
    
    /**
     * 크기 측정 화살표 생성
     */
    createDimensionArrows() {
        // 기존 화살표 제거
        this.dimensionArrows.clear();
        this.dimensionTexts.clear();
        
        // 화살표 생성은 업데이트 함수에서 처리
        this.updateDimensionArrows();
    }
    
    /**
     * 크기 측정 화살표 업데이트
     */
    updateDimensionArrows() {
        // 기존 화살표 및 텍스트 제거
        this.dimensionArrows.clear();
        this.dimensionTexts.clear();
        
        if (!this.floorMesh) return;
        
        // 화살표 속성
        const arrowColor = 0xffcc00;
        const arrowHeight = 0.3; // 바닥에서 높이
        const arrowOffset = 0.2; // 바닥 모서리에서 떨어진 거리
        
        // 바닥 크기 가져오기
        const width = this.floorWidth;
        const depth = this.floorDepth;
        
        // 바닥 위치
        const position = this.floorMesh.position.clone();
        
        // 모서리 좌표 계산
        const corners = [
            new THREE.Vector3(position.x - width/2, position.y, position.z - depth/2), // 좌하단
            new THREE.Vector3(position.x + width/2, position.y, position.z - depth/2), // 우하단
            new THREE.Vector3(position.x + width/2, position.y, position.z + depth/2), // 우상단
            new THREE.Vector3(position.x - width/2, position.y, position.z + depth/2)  // 좌상단
        ];
        
        // 가로 측정 화살표 (아래쪽)
        this.createDimensionArrow(
            new THREE.Vector3(corners[0].x, arrowHeight, corners[0].z - arrowOffset),
            new THREE.Vector3(corners[1].x, arrowHeight, corners[1].z - arrowOffset),
            `${width.toFixed(2)}m`,
            arrowColor,
            new THREE.Vector3(0, arrowHeight, corners[0].z - arrowOffset - 0.2)
        );
        
        // 가로 측정 화살표 (위쪽)
        this.createDimensionArrow(
            new THREE.Vector3(corners[3].x, arrowHeight, corners[3].z + arrowOffset),
            new THREE.Vector3(corners[2].x, arrowHeight, corners[2].z + arrowOffset),
            `${width.toFixed(2)}m`,
            arrowColor,
            new THREE.Vector3(0, arrowHeight, corners[3].z + arrowOffset + 0.2)
        );
        
        // 세로 측정 화살표 (왼쪽)
        this.createDimensionArrow(
            new THREE.Vector3(corners[0].x - arrowOffset, arrowHeight, corners[0].z),
            new THREE.Vector3(corners[3].x - arrowOffset, arrowHeight, corners[3].z),
            `${depth.toFixed(2)}m`,
            arrowColor,
            new THREE.Vector3(corners[0].x - arrowOffset - 0.2, arrowHeight, 0)
        );
        
        // 세로 측정 화살표 (오른쪽)
        this.createDimensionArrow(
            new THREE.Vector3(corners[1].x + arrowOffset, arrowHeight, corners[1].z),
            new THREE.Vector3(corners[2].x + arrowOffset, arrowHeight, corners[2].z),
            `${depth.toFixed(2)}m`,
            arrowColor,
            new THREE.Vector3(corners[1].x + arrowOffset + 0.2, arrowHeight, 0)
        );
    }
    
    /**
     * 모서리 간 거리 화살표 생성
     */
    createCornerArrows() {
        // 기존 화살표 제거
        this.cornerArrows.clear();
        this.cornerTexts.clear();
        
        // 화살표 생성은 업데이트 함수에서 처리
        this.updateCornerArrows();
    }
    
    /**
     * 모서리 간 거리 화살표 업데이트
     */
    updateCornerArrows() {
        // 기존 화살표 및 텍스트 제거
        this.cornerArrows.clear();
        this.cornerTexts.clear();
        
        if (!this.floorMesh || !this.floorGrid) return;
        
        // 화살표 속성
        const arrowColor = 0x00ffff; // 청록색으로 구분
        const arrowHeight = 0.2; 
        
        // 바닥 크기 및 위치
        const floorWidth = this.floorWidth;
        const floorDepth = this.floorDepth;
        const floorPosition = this.floorMesh.position.clone();
        
        // 바닥의 좌측 상단 모서리
        const floorLeftTop = new THREE.Vector3(
            floorPosition.x - floorWidth/2,
            floorPosition.y,
            floorPosition.z + floorDepth/2
        );
        
        // 그리드 원점 위치
        const gridOrigin = new THREE.Vector3(
            floorLeftTop.x + this.gridLeftOffset,
            floorLeftTop.y + 0.05,
            floorLeftTop.z - this.gridTopOffset
        );
        
        // 그리드 오프셋 화살표 (좌측)
        if (this.gridLeftOffset > 0.05) {
            this.createCornerDistanceArrow(
                new THREE.Vector3(floorLeftTop.x, arrowHeight, floorLeftTop.z - this.gridTopOffset),
                new THREE.Vector3(gridOrigin.x, arrowHeight, gridOrigin.z),
                `X: ${this.gridLeftOffset.toFixed(2)}m`,
                arrowColor,
                new THREE.Vector3(
                    floorLeftTop.x + this.gridLeftOffset/2,
                    arrowHeight,
                    floorLeftTop.z - this.gridTopOffset - 0.2
                )
            );
        }
        
        // 그리드 오프셋 화살표 (상단)
        if (this.gridTopOffset > 0.05) {
            this.createCornerDistanceArrow(
                new THREE.Vector3(floorLeftTop.x + this.gridLeftOffset, arrowHeight, floorLeftTop.z),
                new THREE.Vector3(gridOrigin.x, arrowHeight, gridOrigin.z),
                `Z: ${this.gridTopOffset.toFixed(2)}m`,
                arrowColor,
                new THREE.Vector3(
                    floorLeftTop.x + this.gridLeftOffset + 0.2,
                    arrowHeight,
                    floorLeftTop.z - this.gridTopOffset/2
                )
            );
        }
    }
    
    /**
     * 화살표 생성 헬퍼 함수
     */
    createDimensionArrow(start, end, text, color, textPosition) {
        // 화살표 방향 계산
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        
        // 화살표 길이
        const length = start.distanceTo(end);
        
        // 화살표 헤드 크기
        const headLength = Math.min(0.2, length * 0.2);
        const headWidth = headLength * 0.5;
        
        // 화살표 생성
        const arrowHelper = new THREE.ArrowHelper(
            direction,
            start,
            length,
            color,
            headLength,
            headWidth
        );
        
        // 화살표 그룹에 추가
        this.dimensionArrows.add(arrowHelper);
        
        // 텍스트 레이블 생성
        if (text) {
            const label = this.createDimensionLabel(text, textPosition);
            this.dimensionTexts.add(label);
        }
    }
    
    /**
     * 모서리 간 거리 화살표 생성 헬퍼 함수
     */
    createCornerDistanceArrow(start, end, text, color, textPosition) {
        // 화살표 방향 계산
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        
        // 화살표 길이
        const length = start.distanceTo(end);
        
        // 화살표 헤드 크기
        const headLength = Math.min(0.15, length * 0.15);
        const headWidth = headLength * 0.5;
        
        // 양방향 화살표 생성 (양쪽에 헤드 표시)
        // 첫 번째 방향
        const arrowHelper1 = new THREE.ArrowHelper(
            direction,
            start,
            length * 0.45, // 중간까지만
            color,
            headLength,
            headWidth
        );
        
        // 두 번째 방향 (반대)
        const reverseDirection = direction.clone().negate();
        const arrowHelper2 = new THREE.ArrowHelper(
            reverseDirection,
            end,
            length * 0.45, // 중간까지만
            color,
            headLength,
            headWidth
        );
        
        // 화살표 그룹에 추가
        this.cornerArrows.add(arrowHelper1);
        this.cornerArrows.add(arrowHelper2);
        
        // 텍스트 레이블 생성
        if (text) {
            const label = this.createCornerDistanceLabel(text, textPosition);
            this.cornerTexts.add(label);
        }
    }
    
    /**
     * 치수 텍스트 레이블 생성
     */
    createDimensionLabel(text, position) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // 배경
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 테두리
        context.strokeStyle = '#ffcc00';
        context.lineWidth = 3;
        context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
        
        // 텍스트
        context.fillStyle = '#ffcc00';
        context.font = 'Bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(1, 0.25, 1);
        
        return sprite;
    }
    
    /**
     * 모서리 간 거리 텍스트 레이블 생성
     */
    createCornerDistanceLabel(text, position) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // 배경
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 테두리
        context.strokeStyle = '#00ffff';
        context.lineWidth = 3;
        context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
        
        // 텍스트
        context.fillStyle = '#00ffff';
        context.font = 'Bold 20px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(0.8, 0.2, 1);
        
        return sprite;
    }
    
    /**
     * 바닥 도형 크기 설정
     */
    setFloorSize(width, depth) {
        // 유효성 검사
        if (width <= 0 || depth <= 0) return false;
        
        // 새 바닥 도형 생성
        this.createFloorPlan(width, depth);
        
        return true;
    }
    
    /**
     * 그리드 오프셋 설정
     */
    setGridOffset(leftOffset, topOffset) {
        // 유효성 검사
        if (leftOffset < 0 || topOffset < 0) return false;
        
        // 새 오프셋 저장
        this.gridLeftOffset = leftOffset;
        this.gridTopOffset = topOffset;
        
        // 그리드 재생성
        this.createGrid();
        
        return true;
    }
    
    /**
     * 마우스 다운 이벤트 처리
     */
    handleMouseDown(raycaster, mousePosition) {
        if (!this.moveMode) return false;
        
        // 레이캐스팅으로 객체 찾기
        const intersects = raycaster.intersectObject(this.floorGrid, true);
        
        if (intersects.length > 0) {
            const intersected = intersects[0].object;
            
            // 드래그 가능한 객체 찾기
            let draggableObject = null;
            
            if (intersected.userData.isGridLine || intersected.userData.isFloorGridPlane) {
                draggableObject = this.floorGrid;
            } else {
                // 부모 객체 확인
                let parent = intersected.parent;
                while (parent) {
                    if (parent === this.floorGrid) {
                        draggableObject = this.floorGrid;
                        break;
                    }
                    parent = parent.parent;
                }
            }
            
            if (draggableObject) {
                // 드래그 시작
                this.isDragging = true;
                this.selectedObject = draggableObject;
                
                // 시작 위치 저장
                this.dragStartPoint = intersects[0].point.clone();
                this.objectStartPosition = this.selectedObject.position.clone();
                
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 마우스 이동 이벤트 처리
     */
    handleMouseMove(raycaster) {
        if (!this.moveMode || !this.isDragging || !this.selectedObject) return false;
        
        // 평면 생성 (Y=0 평면)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        // 광선과 평면의 교차점 계산
        const planeIntersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, planeIntersect);
        
        if (planeIntersect) {
            // 이동 벡터 계산
            const moveVector = new THREE.Vector3().subVectors(planeIntersect, this.dragStartPoint);
            
            // 새 위치 계산
            const newPosition = this.objectStartPosition.clone().add(moveVector);
            
            // 그리드 이동
            if (this.selectedObject === this.floorGrid) {
                // 그리드 이동 시 오프셋 업데이트
                const floorPosition = this.floorMesh.position.clone();
                const floorWidth = this.floorWidth;
                const floorDepth = this.floorDepth;
                
                // 바닥의 좌측 상단 모서리
                const floorLeftTop = new THREE.Vector3(
                    floorPosition.x - floorWidth/2,
                    floorPosition.y,
                    floorPosition.z + floorDepth/2
                );
                
                // 새 그리드 원점과 바닥 좌측 상단 간의 거리로 오프셋 계산
                this.gridLeftOffset = newPosition.x - floorLeftTop.x;
                this.gridTopOffset = floorLeftTop.z - newPosition.z;
                
                // 유효성 검사 - 그리드가 바닥 밖으로 나가지 않도록
                if (this.gridLeftOffset < 0) this.gridLeftOffset = 0;
                if (this.gridTopOffset < 0) this.gridTopOffset = 0;
                
                // 그리드 재생성
                this.createGrid();
                
                return true;
            }
            
            return false;
        }
        
        return false;
    }
    
    /**
     * 마우스 업 이벤트 처리
     */
    handleMouseUp() {
        if (!this.moveMode) return false;
        
        // 드래그 종료
        if (this.isDragging) {
            this.isDragging = false;
            this.selectedObject = null;
            return true;
        }
        
        return false;
    }
    
    /**
     * 이동 모드 설정
     */
    setMoveMode(enabled) {
        this.moveMode = enabled;
        
        // 이동 모드 종료 시 드래그 상태도 초기화
        if (!enabled) {
            this.isDragging = false;
            this.selectedObject = null;
        }
        
        return this.moveMode;
    }
    
    /**
     * 패널에 표시할 바닥 정보 반환
     */
    getFloorInfo() {
        return {
            width: this.floorWidth,
            depth: this.floorDepth,
            leftOffset: this.gridLeftOffset,
            topOffset: this.gridTopOffset,
            floorPosition: {
                x: this.floorMesh ? this.floorMesh.position.x.toFixed(2) : '0.00',
                z: this.floorMesh ? this.floorMesh.position.z.toFixed(2) : '0.00'
            }
        };
    }
    
    /**
     * 업데이트 (매 프레임 호출)
     */
    update() {
        // 필요하다면 여기에 프레임별 업데이트 로직 추가
        if (this.isDragging && this.selectedObject) {
            // 모서리 간 거리 업데이트
            this.updateCornerArrows();
        }
    }
    
    /**
     * 리소스 해제
     */
    dispose() {
        // 메시 제거
        if (this.floorMesh) {
            this.scene.remove(this.floorMesh);
            if (this.floorMesh.geometry) this.floorMesh.geometry.dispose();
            if (this.floorMesh.material) this.floorMesh.material.dispose();
            this.floorMesh = null;
        }
        
        // 그리드 제거
        if (this.floorGrid) {
            this.scene.remove(this.floorGrid);
            // 그리드 내부 요소들의 리소스 해제
            this.floorGrid.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.floorGrid = null;
        }
        
        // 화살표 제거
        this.scene.remove(this.dimensionArrows);
        this.scene.remove(this.dimensionTexts);
        this.scene.remove(this.cornerArrows);
        this.scene.remove(this.cornerTexts);
        
        // 화살표와 텍스트의 리소스 해제
        this.dimensionArrows.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        this.dimensionTexts.traverse(child => {
            if (child.material && child.material.map) {
                child.material.map.dispose();
            }
            if (child.material) child.material.dispose();
        });
        
        this.cornerArrows.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        this.cornerTexts.traverse(child => {
            if (child.material && child.material.map) {
                child.material.map.dispose();
            }
            if (child.material) child.material.dispose();
        });
    }
}