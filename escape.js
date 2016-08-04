const _ = require('lodash');
const blessed = require('blessed');
const pathfinding = require('pathfinding');

const DUNGEON = `
#########################################################################
#   #               #               #           #                   #   #
#   #   #########   #   #####   #########   #####   #####   #####   #   #
#               #       #   #           #           #   #   #       #   #
#########   #   #########   #########   #####   #   #   #   #########   #
#       #   #               #           #   #   #   #   #           #   #
#   #   #############   #   #   #########   #####   #   #########   #   #
#   #               #   #   #       #           #           #       #   #
#   #############   #####   #####   #   #####   #########   #   #####   #
#           #       #   #       #   #       #           #   #           #
#   #####   #####   #   #####   #   #########   #   #   #   #############
#       #       #   #   #       #       #       #   #   #       #       #
#############   #   #   #   #########   #   #####   #   #####   #####   #
#           #   #           #       #   #       #   #       #           #
#   #####   #   #########   #####   #   #####   #####   #############   #
#   #       #           #           #       #   #   #               #   #
#   #   #########   #   #####   #########   #   #   #############   #   #
#   #           #   #   #   #   #           #               #   #       #
#   #########   #   #   #   #####   #########   #########   #   #########
#   #       #   #   #           #           #   #       #               #
#   #   #####   #####   #####   #########   #####   #   #########   #   #
#   #                   #           #               #               #   #
# X #####################################################################
`;

class Cell {
    constructor (x, y) {
        this.x = x;
        this.y = y;
    }

    equals (other) {
        return _.isEqual(this, other);
    }

    add (other) {
        return new Cell(this.x + other.x, this.y + other.y);
    }
}

const DIRECTION = {
    UP    : {cell: new Cell(0, -1), icon: '^'},
    DOWN  : {cell: new Cell(0,  1), icon: 'v'},
    LEFT  : {cell: new Cell(-1, 0), icon: '<'},
    RIGHT : {cell: new Cell(1,  0), icon: '>'}
}

const CELL = {
    EMPTY: ' ',
    WALL:  '#',
    EXIT:  'X'
}

const GAME_STATE = {
    PLAYING: 1,
    STOPPED: 2
}

class Being {
    constructor (game, position) {
        this.game = game;
        this.position = position;
        this.displayBox = blessed.box({
            width:  1,
            height: 1,
            top:    0,
            left:   0
        });
    }

    get displayIcon () {
        return '@';
    }

    display () {
        this.displayBox.left = this.position.x;
        this.displayBox.top = this.position.y;
        this.displayBox.setContent(this.displayIcon);
    }
}

class Hero extends Being {
    constructor (game, position) {
        super(game, position);
        this._direction = 'UP';
        this.displayBox.style.fg = 'green';
    }

    get direction () { return DIRECTION[this._direction]; }
    set direction (val) { this._direction = val.toUpperCase(); }

    get displayIcon () {
        return this.direction.icon;
    }

    changeDirection (newDirection) {
        this.direction = newDirection;
        const newPosition = this.position.add(this.direction.cell);
        if (this.game.dungeon.cellIs(newPosition, [CELL.EMPTY, CELL.EXIT])) {
             this.position = newPosition;
        } else if (this.game.dungeon.pushCell(newPosition, this.direction.cell)) {
            this.position = this.position.add(this.direction.cell);
        }
    }
}

class Troll extends Being {
    constructor (game, position) {
        super(game, position);
        this.displayBox.style.fg = 'red';
    }

    get displayIcon () {
        return 'T';
    }

    catchHero () {
        let grid = new pathfinding.Grid(this.game.dungeon.walkableMatrix);
        let finder = new pathfinding.AStarFinder();
        let path = finder.findPath(this.position.x, this.position.y, this.game.hero.position.x, this.game.hero.position.y, grid);
        if (path.length >= 1) {
            this.position = new Cell(path[1][0], path[1][1]);

            if (this.position.equals(this.game.hero.position)) {
                this.game.lose();
            }
        }
    }
}

class Dungeon {
    constructor (game, map) {
        this.game = game;

        const rawMap = map.split('\n').filter(r => r.trim() !== '').join('\n');

        this.map = rawMap.split('\n').map(r => r.split(''));
        this.width = this.map[0].length;
        this.height = this.map.length;
        this.exit = (() => {
            let y = _.findIndex(this.map, r => _.includes(r, CELL.EXIT));
            let x = _.findIndex(this.map[y], c => c === CELL.EXIT);
            return new Cell(x, y);
        })();

        this.dungeonBox = blessed.box({
            width:  this.width,
            height: this.height,
            top:    0,
            left:   0
        });
    }

    randomCell () {
        return new Cell(_.random(this.width - 1), _.random(this.height - 1));
    }

    cellIs (cell, types) {
        try {
            if (!_.isArray(types)) types = [types];
            return _.some(types, t => this.map[cell.y][cell.x] === t);
        } catch (e) {
            return false;
        }
    }

    cellIsEmpty (cell) {
        let empty = this.cellIs(cell, CELL.EMPTY);
        if (empty && this.game.hero) {
            empty = !cell.equals(this.game.hero.position);
        }
        if (empty && this.game.trolls) {
            empty = !_.some(this.game.trolls, t => cell.equals(t.position));
        }
        return empty;
    }

    get walkableMatrix () {
        return _.map(this.map, (r, y) => _.map(r, (c, x) => this.cellIs(new Cell(x, y), CELL.EMPTY) ? 0 : 1));
    }

    randomEmptyCell () {
        let cell;
        do {
            cell = this.randomCell();
        } while (!this.cellIsEmpty(cell));
        return cell;
    }

    display () {
        let content = '';

        _.each(this.map, (row, y) => {
            _.each(row, (cell, x) => {
                content += cell;
            });
            content += '\n';
        })

        this.dungeonBox.setContent(content);
    }

    pushCell (cell, direction) {
        if (!this.cellIs(cell, CELL.WALL)) return false;

        const pushToCell = cell.add(direction);
        if (this.cellIs(pushToCell, CELL.EMPTY)) {
            this.map[cell.y][cell.x] = CELL.EMPTY;
            this.map[pushToCell.y][pushToCell.x] = CELL.WALL;
            return true;
        } else {
            return false;
        }
    }
}

class Game {
    constructor (dungeonMap, numberTrolls = 0) {
        this.screen = blessed.screen({
            smartCSR: true
        });

        this.state = GAME_STATE.PLAYING;

        this.dungeon = new Dungeon(this, DUNGEON);
        this.hero = new Hero(this, this.dungeon.randomEmptyCell());

        this.screen.append(this.dungeon.dungeonBox);
        this.screen.append(this.hero.displayBox);

        // add trolls
        this.trolls = [];
        _.times(numberTrolls, () => {
            let troll = new Troll(this, this.dungeon.randomEmptyCell());
            this.trolls.push(troll);
            this.screen.append(troll.displayBox);
        });

        this.screen.key(['escape', 'q', 'C-c'], (ch, key) => {
          return process.exit(0);
        });

        this.screen.on('keypress', (key, ch) => {
            if (this.state === GAME_STATE.STOPPED) return;

            if (_.includes(['up', 'down', 'left', 'right'], ch.name)) {
                this.hero.changeDirection(ch.name);
            }

            if (this.hero.position.equals(this.dungeon.exit)) {
                this.win();
            }

            this.display();
        });

        this.display();
    }

    alert (message) {
        this.dungeon.dungeonBox.append(blessed.box({
            top: 'center',
            left: 'center',
            width: '50%',
            height: '50%',
            content: `\n\n{center}{bold}${message}{/bold}!`,
            tags: true,
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                border: {
                    fg: 'white'
                },
            }
        }));

        this.screen.render();
    }

    win () {
        this.state = GAME_STATE.STOPPED
        this.alert('YOU WIN');
    }

    lose () {
        this.state = GAME_STATE.STOPPED
        this.alert('YOU LOSE');
    }

    display () {
        this.dungeon.display();
        this.hero.display();
        _.each(this.trolls, t => {
            t.catchHero();
            t.display();
        });
        this.screen.render();
    }
}

const game = new Game(DUNGEON, 5);
