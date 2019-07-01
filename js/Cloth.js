/*
 * Cloth Simulation using a relaxed constraints solver
 */

// Suggested Readings

// Advanced Character Physics by Thomas Jakobsen Character
// http://freespace.virgin.net/hugo.elias/models/m_cloth.htm
// http://en.wikipedia.org/wiki/Cloth_modeling
// http://cg.alexandra.dk/tag/spring-mass-system/
// Real-time Cloth Animation http://www.darwin3d.com/gamedev/articles/col0599.pdf

var DAMPING = 0.03; //阻尼
var DRAG = 1 - DAMPING; //阻力
var MASS = 0.1; //质量
var restDistance = 25; //粒子点之间的距离

var xSegs = 10;
var ySegs = 10;

var clothFunction = plane(restDistance * xSegs, restDistance * ySegs); //250 * 250 

//cloth function
function plane(width, height) {

	return function (u, v, target) {
		//为啥要这样计算 x y
		var x = (u - 0.5) * width; //整个布料向左平移 0.5 * SCALE 的距离
		var y = (v + 0.5) * height; //整个布料向上平移 0.5 * SCALE 的距离
		var z = 0;

		target.set(x, y, z);

	};

}

var cloth = new Cloth(xSegs, ySegs);

var GRAVITY = 981 * 1.4; //重力g  1373.4
var gravity = new THREE.Vector3(0, -GRAVITY, 0).multiplyScalar(MASS); //multiplyScalar四维向量进行缩放，比例为mass
//重力向量 即物理上mg 
//产生一个y轴负方向的力，即向下
var TIMESTEP = 18 / 1000; //时间戳 每18ms运行一次
var TIMESTEP_SQ = TIMESTEP * TIMESTEP;

//悬挂点
var pins = [];

//风的参数
var wind = true;
var windStrength = 2;
var windForce = new THREE.Vector3(0, 0, 0);

//球的参数
var ballPosition = new THREE.Vector3(0, -45, 0); //球体位置
var ballSize = 60; //40

var tmpForce = new THREE.Vector3();

var lastTime;


//粒子类
function Particle(x, y, z, mass) {

	this.position = new THREE.Vector3(); //不填参数位置会被设置为（0,0,0）
	this.previous = new THREE.Vector3();
	this.original = new THREE.Vector3();
	this.a = new THREE.Vector3(); // acceleration  加速度
	this.mass = mass; //质量
	this.invMass = 1 / mass; //质量的倒数
	this.tmp = new THREE.Vector3(); //保存两个位置的差值
	this.tmp2 = new THREE.Vector3(); //保存力

	// init

	//生成target的 coordinate(x,y,z)

	clothFunction(x, y, this.position); // position  当前位置   
	clothFunction(x, y, this.previous); // previous  之前的位置
	clothFunction(x, y, this.original); // 最初的位置

}

// Force -> Acceleration  通过力生成加速度
// 力 => 加速度
Particle.prototype.addForce = function (force) {

	this.a.add(
		this.tmp2.copy(force).multiplyScalar(this.invMass) // a = F / m
	);

};


// Performs Verlet integration 整合||集成  重新生成新的坐标点

Particle.prototype.integrate = function (timesq) {

	var newPos = this.tmp.subVectors(this.position, this.previous); //当前位置 - 之前位置
	newPos.multiplyScalar(DRAG).add(this.position);
	newPos.add(this.a.multiplyScalar(timesq / 2)); // 距离不应该是 S = 1/2 * a * t * t 吗 少乘以 1/2？

	this.tmp = this.previous;
	this.previous = this.position;
	this.position = newPos;

	this.a.set(0, 0, 0);

};


var diff = new THREE.Vector3();

//安全约束
//考虑相邻的两个点 diff是两个点之间的向量差 diff.length是两个点之间的欧式距离
//distance恒等于25 假如两个点之间的距离变大了 比如等于26 那么系数为 1 - 25/26 = 1/26 > 0  那么各自退让一步，使距离变小。反之亦然。
function satisfyConstraints(p1, p2, distance) {
	//distance始终是原始距离25
	diff.subVectors(p2.position, p1.position); 
	//debugger
	var currentDist = diff.length();
	if (currentDist === 0) return; // prevents division by 0
	var correction = diff.multiplyScalar(1 - distance / currentDist);
	var correctionHalf = correction.multiplyScalar(0.5);
	p1.position.add(correctionHalf);
	p2.position.sub(correctionHalf);

}

//布料类 w h 是边的个数
function Cloth(w, h) {

	w = w || 10;
	h = h || 10;
	this.w = w;
	this.h = h;

	var particles = []; //粒子
	var constraints = []; //约束条件

	var u, v;

	// Create particles
	for (v = 0; v <= h; v++) {

		for (u = 0; u <= w; u++) {

			particles.push(
				new Particle(u / w, v / h, 0, MASS) //定义一个粒子的位置  与  质量 MASS = 0.1
			);

		}

	}

	console.log(particles) // 顶点 11 * 11

	// Structural 结构
	// 用 10 * 10 距离 每个点之间的间隔是 restDistance
	for (v = 0; v < h; v++) {

		for (u = 0; u < w; u++) {
			// console.log(index(u, v));
			// console.log(index(u, v + 1))
			constraints.push([
				particles[index(u, v)],
				particles[index(u, v + 1)],
				restDistance
			]);
			// console.log('-------------------')

			// console.log(index(u, v));
			// console.log(index(u + 1, v))

			constraints.push([
				particles[index(u, v)],
				particles[index(u + 1, v)],
				restDistance
			]);
			//console.log('********************')
		}

	}
	//debugger
	for (u = w, v = 0; v < h; v++) {
		console.log(index(u, v))
		console.log(index(u, v + 1))
		console.log('********************')
		constraints.push([
			particles[index(u, v)],
			particles[index(u, v + 1)],
			restDistance
		]);

	}

	for (v = h, u = 0; u < w; u++) {

		constraints.push([
			particles[index(u, v)],
			particles[index(u + 1, v)],
			restDistance
		]);

	}

	console.log(constraints)

	// While many systems use shear and bend springs, 剪切与 弯曲弹簧
	// the relaxed constraints model seems to be just fine
	// using structural springs.
	// Shear
	// var diagonalDist = Math.sqrt(restDistance * restDistance * 2);

	this.particles = particles;
	this.constraints = constraints;

	function index(u, v) {

		return u + v * (w + 1);

	}

	this.index = index;

}

//模拟
function simulate(time) {

	if (!lastTime) {

		lastTime = time;
		return;

	}

	var i, il, particles, particle, constraints, constraint;

	// Aerodynamics forces

	if (wind) {

		var face, faces = clothGeometry.faces,
			normal;

		particles = cloth.particles;

		for (i = 0, il = faces.length; i < il; i++) {

			face = faces[i];
			normal = face.normal;

			tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(windForce));
			particles[face.a].addForce(tmpForce);
			particles[face.b].addForce(tmpForce);
			particles[face.c].addForce(tmpForce);

		}

	}

	for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {

		particle = particles[i];
		particle.addForce(gravity);  //添加重力

		particle.integrate(TIMESTEP_SQ);

	}

	// Start Constraints 布料本身的约束条件

	constraints = cloth.constraints;
	il = constraints.length; //220

	for (i = 0; i < il; i++) {

		constraint = constraints[i];
		satisfyConstraints(constraint[0], constraint[1], constraint[2]);  //相邻点的位置 与距离

	}

	// Ball Constraints

	ballPosition.z = -Math.sin(Date.now() / 600) * 90; //+ 40;  动态改变球体的位置
	ballPosition.x = Math.cos(Date.now() / 400) * 70;

	if (sphere.visible) {

		for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {

			particle = particles[i];
			var pos = particle.position;
			diff.subVectors(pos, ballPosition);
			//debugger
			if (diff.length() < ballSize) {

				// collided  碰撞
				diff.normalize().multiplyScalar(ballSize);
				pos.copy(ballPosition).add(diff);

			}

		}

	}


	// Floor Constraints   大地的约束条件

	for (particles = cloth.particles, i = 0, il = particles.length; i < il; i++) {

		particle = particles[i];
		pos = particle.position;
		if (pos.y < -250) {

			pos.y = -250;

		}

	}

	//Pin Constraints    悬挂点约束条件

	for (i = 0, il = pins.length; i < il; i++) {
		var xy = pins[i];
		var p = particles[xy];
		p.position.copy(p.original);
		p.previous.copy(p.original);

	}


}