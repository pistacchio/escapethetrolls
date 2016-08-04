const _ = require('lodash');
const blessed = require('blessed');

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
    WON: 2
}

class Hero {
    constructor (game, position) {
        this.game = game;
        this.position = position;
        this._direction = 'UP';
        this.heroBox = blessed.box({
            width:  1,
            height: 1,
            top:    0,
            left:   0,
            style: {
                fg: 'green'
            }
        });
    }

    get direction () { return DIRECTION[this._direction]; }
    set direction (val) { this._direction = val.toUpperCase(); }

    changeDirection (newDirection) {
        this.direction = newDirection;
        if (this.game.dungeon.cellIs(this.position.add(this.direction.cell), [CELL.EMPTY, CELL.EXIT])) {
             this.position = this.position.add(this.direction.cell);
        }
    }

    display () {
        this.heroBox.left = this.position.x;
        this.heroBox.top = this.position.y;
        this.heroBox.setContent(this.direction.icon);
    }
}

class Dungeon {
    constructor (game, map) {
        this.game = game;

        const rawMap = map.split('\n').filter(r => r.trim() !== '').join('\n');

        this.dungeon = rawMap.split('\n').map(r => r.split(''));
        this.width = this.dungeon[0].length;
        this.height = this.dungeon.length;
        this.exit = (() => {
            let y = _.findIndex(this.dungeon, r => _.includes(r, CELL.EXIT));
            let x = _.findIndex(this.dungeon[y], c => c === CELL.EXIT);
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
        if (!_.isArray(types)) types = [types];
        return _.some(types, t => this.dungeon[cell.y][cell.x] === t);
    }

    randomEmptyCell () {
        let cell;
        do {
            cell = this.randomCell();
        } while (!this.cellIs(cell, CELL.EMPTY));
        return cell;
    }

    display () {
        let content = '';

        _.each(this.dungeon, (row, y) => {
            _.each(row, (cell, x) => {
                content += cell;
            });
            content += '\n';
        })

        this.dungeonBox.setContent(content);
    }
}

class Game {
    constructor (dungeonMap) {
        this.screen = blessed.screen({
            smartCSR: true
        });

        this.state = GAME_STATE.PLAYING;

        this.dungeon = new Dungeon(this, DUNGEON);
        this.hero = new Hero(this, this.dungeon.randomEmptyCell());

        this.screen.append(this.dungeon.dungeonBox);
        this.screen.append(this.hero.heroBox);

        this.screen.key(['escape', 'q', 'C-c'], (ch, key) => {
          return process.exit(0);
        });

        this.screen.on('keypress', (key, ch) => {
            if (this.state === GAME_STATE.WON) return;

            if (_.includes(['up', 'down', 'left', 'right'], ch.name)) {
                this.hero.changeDirection(ch.name);
                this.display();
            }

            if (this.hero.position.equals(this.dungeon.exit)) {
                this.dungeon.dungeonBox.append(blessed.box({
                    top: 'center',
                    left: 'center',
                    width: '50%',
                    height: '50%',
                    content: '\n\n{center}{bold}YOU WON{/bold}!',
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

                this.state = GAME_STATE.WON;
                this.screen.render();
            }
        });

        this.display();
    }

    display () {
        this.dungeon.display();
        this.hero.display();
        this.screen.render();
    }
}

const game = new Game(DUNGEON);
