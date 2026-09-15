import "reflect-metadata";
import { Controller, Get, Injectable, Module, NotFoundException, Param } from "@nestjs/common";
import { Err, Ok, type Result } from "@typers/core";
import { UserRepository, type User, type UserNotFound } from "./app.js";

@Injectable()
export class PatternUsersService {
  constructor(private readonly repository: UserRepository) {}

  findById(id: string): Result<User, UserNotFound> {
    if let Some(user) = this.repository.findById(id) {
      return Ok(user);
    }
    return Err({ kind: "UserNotFound", id });
  }
}

@Controller("users")
export class PatternUsersController {
  constructor(private readonly users: PatternUsersService) {}

  @Get(":id")
  getUser(@Param("id") id: string): User {
    const result = this.users.findById(id);
    if (result.kind === "err") throw new NotFoundException(result.error);
    return result.value;
  }
}

@Module({ controllers: [PatternUsersController], providers: [UserRepository, PatternUsersService] })
export class PatternAppModule {}
